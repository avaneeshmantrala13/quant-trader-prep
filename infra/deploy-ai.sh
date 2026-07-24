#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Quant Trader Prep — deploy the OPTIONAL AI "flavor / open-ended" layer.
#
# This is ADDITIVE and SEPARATE from the main backend (deploy.sh): it creates a
# second CloudFormation stack with its own Lambda + API Gateway HTTP API +
# Cognito JWT authorizer (pointed at your EXISTING User Pool), then uploads the
# real handler code and appends the AI env vars to your .env.local.
#
# It does NOT modify or redeploy the main auth/data stack.
#
# PREREQUISITES
#   1. You already ran ./infra/deploy.sh (the main stack exists).
#   2. You stored your LLM API key in SSM (see infra/AI_SETUP.md), e.g.:
#        aws ssm put-parameter --name /quant-trader-prep/ai/api-key \
#          --type SecureString --value "sk-..."
#
# Usage:
#   ./infra/deploy-ai.sh                      # OpenAI (default), quota 50/user/day
#   AI_PROVIDER=anthropic AI_MODEL=claude-3-5-haiku-latest ./infra/deploy-ai.sh
#   # TrueFoundry AI Gateway (OpenAI-compatible; store your PAT/VAT in SSM):
#   AI_BASE_URL=https://gateway.truefoundry.ai AI_MODEL=openai-main/gpt-4o-mini \
#     ./infra/deploy-ai.sh
#
# Optional env overrides:
#   AWS_REGION, MAIN_STACK_NAME (default quant-trader-prep),
#   STACK_NAME (default quant-trader-prep-ai), PROJECT_NAME,
#   AI_PROVIDER (openai|openai-compatible|anthropic), AI_BASE_URL, AI_MODEL,
#   AI_SSM_PARAM, DAILY_QUOTA, CORS_ORIGINS, ENV_OUT (default .env.local)
#
# Restricted / sandbox accounts (IAM permissions boundary):
#   PERMISSIONS_BOUNDARY_ARN   IAM policy ARN attached to every role this stack
#                              creates. If unset, the script auto-detects a policy
#                              named PERMISSIONS_BOUNDARY_NAME (default
#                              InternSandboxBoundary) in the current account and
#                              uses it when present; otherwise none is attached.
#   PERMISSIONS_BOUNDARY_NAME  Policy name to auto-detect (default InternSandboxBoundary).
# ---------------------------------------------------------------------------
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/.." && pwd)"
TEMPLATE="$HERE/cloudformation/quant-trader-prep-ai.yaml"
LAMBDA_DIR="$HERE/lambda/ai-flavor"

MAIN_STACK_NAME="${MAIN_STACK_NAME:-quant-trader-prep}"
STACK_NAME="${STACK_NAME:-quant-trader-prep-ai}"
PROJECT_NAME="${PROJECT_NAME:-quant-trader-prep}"
AWS_REGION="${AWS_REGION:-$(aws configure get region 2>/dev/null || echo us-east-1)}"
AI_PROVIDER="${AI_PROVIDER:-openai}"
# OpenAI-compatible base URL. Default = raw OpenAI (plain-OpenAI users unchanged).
# Set AI_BASE_URL=https://gateway.truefoundry.ai to target the TrueFoundry AI
# Gateway SaaS (self-hosted: use your own gateway URL from the Playground).
AI_BASE_URL="${AI_BASE_URL:-https://api.openai.com/v1}"
AI_MODEL="${AI_MODEL:-gpt-4o-mini}"
AI_SSM_PARAM="${AI_SSM_PARAM:-/quant-trader-prep/ai/api-key}"
DAILY_QUOTA="${DAILY_QUOTA:-50}"
CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:5173,http://localhost:4173}"
ENV_OUT="${ENV_OUT:-$REPO_ROOT/.env.local}"

# ---- IAM permissions boundary (for restricted / sandbox accounts). ----------
# Same auto-detect behavior as deploy.sh: use PERMISSIONS_BOUNDARY_ARN if set,
# else auto-detect PERMISSIONS_BOUNDARY_NAME in the current account, else none.
PERMISSIONS_BOUNDARY_ARN="${PERMISSIONS_BOUNDARY_ARN:-}"
PERMISSIONS_BOUNDARY_NAME="${PERMISSIONS_BOUNDARY_NAME:-InternSandboxBoundary}"
if [ -z "$PERMISSIONS_BOUNDARY_ARN" ]; then
  ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text 2>/dev/null || true)"
  if [ -n "$ACCOUNT_ID" ] && [ "$ACCOUNT_ID" != "None" ]; then
    CANDIDATE="arn:aws:iam::${ACCOUNT_ID}:policy/${PERMISSIONS_BOUNDARY_NAME}"
    if aws iam get-policy --policy-arn "$CANDIDATE" >/dev/null 2>&1; then
      PERMISSIONS_BOUNDARY_ARN="$CANDIDATE"
    fi
  fi
fi

get_main_out() {
  aws cloudformation describe-stacks \
    --region "$AWS_REGION" \
    --stack-name "$MAIN_STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" \
    --output text
}

echo "==> Reading EXISTING user pool from '$MAIN_STACK_NAME'"
USER_POOL_ID="$(get_main_out UserPoolId)"
USER_POOL_CLIENT_ID="$(get_main_out UserPoolClientId)"
if [ -z "$USER_POOL_ID" ] || [ "$USER_POOL_ID" = "None" ]; then
  echo "ERROR: could not read UserPoolId from stack '$MAIN_STACK_NAME'." >&2
  echo "       Run ./infra/deploy.sh first (or set MAIN_STACK_NAME)." >&2
  exit 1
fi
echo "    UserPoolId=$USER_POOL_ID  ClientId=$USER_POOL_CLIENT_ID"

echo "==> Deploying AI stack '$STACK_NAME' ($AI_PROVIDER / $AI_MODEL @ $AI_BASE_URL)"
[ -n "$PERMISSIONS_BOUNDARY_ARN" ] && echo "    Permissions boundary: $PERMISSIONS_BOUNDARY_ARN" || echo "    Permissions boundary: none"
aws cloudformation deploy \
  --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" \
  --template-file "$TEMPLATE" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    ProjectName="$PROJECT_NAME" \
    UserPoolId="$USER_POOL_ID" \
    UserPoolClientId="$USER_POOL_CLIENT_ID" \
    AiProvider="$AI_PROVIDER" \
    AiBaseUrl="$AI_BASE_URL" \
    AiModel="$AI_MODEL" \
    AiSsmParam="$AI_SSM_PARAM" \
    DailyQuota="$DAILY_QUOTA" \
    CorsOrigins="$CORS_ORIGINS" \
    PermissionsBoundaryArn="$PERMISSIONS_BOUNDARY_ARN"

get_ai_out() {
  aws cloudformation describe-stacks \
    --region "$AWS_REGION" \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" \
    --output text
}
AI_ENDPOINT="$(get_ai_out AiEndpoint)"
AI_FUNCTION="$(get_ai_out AiFunctionName)"

echo "==> Uploading real Lambda code from $LAMBDA_DIR"
TMP_ZIP="$(mktemp -t qtp-ai.XXXXXX.zip)"
rm -f "$TMP_ZIP"   # mktemp pre-creates a 0-byte file; macOS `zip` refuses it, so remove it first
( cd "$LAMBDA_DIR" && zip -q -r "$TMP_ZIP" index.mjs )
aws lambda update-function-code \
  --region "$AWS_REGION" \
  --function-name "$AI_FUNCTION" \
  --zip-file "fileb://$TMP_ZIP" >/dev/null
rm -f "$TMP_ZIP"
echo "    Uploaded to $AI_FUNCTION"

echo "==> Appending AI env vars to $ENV_OUT"
# Remove any prior AI_* lines, then append fresh ones (idempotent).
if [ -f "$ENV_OUT" ]; then
  grep -v -E '^(VITE_AI_LAYER|VITE_AI_ENDPOINT|VITE_AI_PROVIDER|VITE_AI_STUB)=' "$ENV_OUT" > "$ENV_OUT.tmp" || true
  mv "$ENV_OUT.tmp" "$ENV_OUT"
fi
cat >> "$ENV_OUT" <<EOF

# ---- Optional AI flavor / open-ended layer (added by infra/deploy-ai.sh) ----
VITE_AI_LAYER=on
VITE_AI_ENDPOINT=$AI_ENDPOINT
VITE_AI_PROVIDER=$AI_PROVIDER
EOF

echo ""
echo "==> Done."
echo "    AI endpoint: $AI_ENDPOINT   (client POSTs to \${endpoint}/ai)"
echo "    Restart the dev server (npm run dev) to pick up the new env."
