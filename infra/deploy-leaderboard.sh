#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Quant Trader Prep — deploy the Speed Arena LEADERBOARD (Phase 6).
#
# ADDITIVE and SEPARATE from the main backend (deploy.sh) and the AI layer
# (deploy-ai.sh): it creates its OWN CloudFormation stack with a
# server-authoritative Lambda + API Gateway HTTP API + Cognito JWT authorizer
# (pointed at your EXISTING User Pool) + ONE PROVISIONED DynamoDB table
# (25 WCU / 25 RCU, no GSIs), then uploads the real handler code and appends the
# leaderboard env vars to your .env.local.
#
# It does NOT modify or redeploy the main auth/data stack or the AI stack.
#
# PREREQUISITE: you already ran ./infra/deploy.sh (the main stack exists).
#
# Usage:
#   ./infra/deploy-leaderboard.sh
#
# Optional env overrides:
#   AWS_REGION, MAIN_STACK_NAME (default quant-trader-prep),
#   STACK_NAME (default quant-trader-prep-leaderboard), PROJECT_NAME,
#   TOPN, LEAGUE_COUNT, RANKED_PER_HOUR, READ_CAPACITY, WRITE_CAPACITY,
#   CORS_ORIGINS, ENV_OUT (default .env.local)
#
# Restricted / sandbox accounts (IAM permissions boundary):
#   PERMISSIONS_BOUNDARY_ARN / PERMISSIONS_BOUNDARY_NAME — same auto-detect
#   behavior as deploy.sh / deploy-ai.sh.
# ---------------------------------------------------------------------------
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/.." && pwd)"
TEMPLATE="$HERE/cloudformation/quant-trader-prep-leaderboard.yaml"
LAMBDA_DIR="$HERE/lambda/leaderboard"

MAIN_STACK_NAME="${MAIN_STACK_NAME:-quant-trader-prep}"
STACK_NAME="${STACK_NAME:-quant-trader-prep-leaderboard}"
PROJECT_NAME="${PROJECT_NAME:-quant-trader-prep}"
AWS_REGION="${AWS_REGION:-$(aws configure get region 2>/dev/null || echo us-east-1)}"
TOPN="${TOPN:-40}"
LEAGUE_COUNT="${LEAGUE_COUNT:-20}"
RANKED_PER_HOUR="${RANKED_PER_HOUR:-60}"
READ_CAPACITY="${READ_CAPACITY:-25}"
WRITE_CAPACITY="${WRITE_CAPACITY:-25}"
CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:5173,http://localhost:4173}"
ENV_OUT="${ENV_OUT:-$REPO_ROOT/.env.local}"

# ---- IAM permissions boundary (for restricted / sandbox accounts). ----------
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

echo "==> Deploying leaderboard stack '$STACK_NAME' (provisioned $WRITE_CAPACITY WCU / $READ_CAPACITY RCU)"
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
    TopN="$TOPN" \
    LeagueCount="$LEAGUE_COUNT" \
    RankedPerHour="$RANKED_PER_HOUR" \
    ReadCapacity="$READ_CAPACITY" \
    WriteCapacity="$WRITE_CAPACITY" \
    CorsOrigins="$CORS_ORIGINS" \
    PermissionsBoundaryArn="$PERMISSIONS_BOUNDARY_ARN"

get_lb_out() {
  aws cloudformation describe-stacks \
    --region "$AWS_REGION" \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" \
    --output text
}
LB_ENDPOINT="$(get_lb_out LeaderboardEndpoint)"
LB_FUNCTION="$(get_lb_out LeaderboardFunctionName)"

echo "==> Uploading real Lambda code from $LAMBDA_DIR (index.mjs + scoring.mjs)"
TMP_ZIP="$(mktemp -t qtp-lb.XXXXXX.zip)"
rm -f "$TMP_ZIP"   # mktemp pre-creates a 0-byte file; macOS `zip` refuses it
( cd "$LAMBDA_DIR" && zip -q -r "$TMP_ZIP" index.mjs scoring.mjs )
aws lambda update-function-code \
  --region "$AWS_REGION" \
  --function-name "$LB_FUNCTION" \
  --zip-file "fileb://$TMP_ZIP" >/dev/null
rm -f "$TMP_ZIP"
echo "    Uploaded to $LB_FUNCTION"

echo "==> Appending leaderboard env vars to $ENV_OUT"
if [ -f "$ENV_OUT" ]; then
  grep -v -E '^(VITE_LEADERBOARD|VITE_LEADERBOARD_ENDPOINT)=' "$ENV_OUT" > "$ENV_OUT.tmp" || true
  mv "$ENV_OUT.tmp" "$ENV_OUT"
fi
cat >> "$ENV_OUT" <<EOF

# ---- Speed Arena leaderboard (added by infra/deploy-leaderboard.sh) ----
VITE_LEADERBOARD=on
VITE_LEADERBOARD_ENDPOINT=$LB_ENDPOINT
EOF

echo ""
echo "==> Done."
echo "    Leaderboard endpoint: $LB_ENDPOINT   (client POSTs to \${endpoint}/leaderboard/*)"
echo "    Restart the dev server (npm run dev) to pick up the new env."
