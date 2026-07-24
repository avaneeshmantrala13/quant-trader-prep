#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Quant Trader Prep — one-command AWS Free-Tier backend deploy.
#
# Creates/updates the Cognito User Pool + App Client (+ optional Google IdP),
# the Cognito Identity Pool + owner-scoped IAM, the DynamoDB tables (on-demand),
# and the Lambda + API Gateway (JWT authorizer) skeleton — all via the AWS CLI
# (no SAM CLI, no S3 bucket needed; Lambda code is inline in the template).
#
# Usage:
#   ./infra/deploy.sh                 # deploy without Google federation
#   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... ./infra/deploy.sh
#
# Optional env overrides:
#   AWS_REGION      (default: your CLI default, else us-east-1)
#   STACK_NAME      (default: quant-trader-prep)
#   PROJECT_NAME    (default: quant-trader-prep)
#   CALLBACK_URLS   (comma list; default: http://localhost:5173/,http://localhost:4173/)
#   LOGOUT_URLS     (comma list; default: same as CALLBACK_URLS)
#   ENV_OUT         (default: .env.local at repo root)
#
# Restricted / sandbox accounts (IAM permissions boundary):
#   PERMISSIONS_BOUNDARY_ARN   IAM policy ARN attached to every role this stack
#                              creates. Some sandbox accounts DENY iam:CreateRole
#                              unless the new role carries the account's boundary.
#                              If unset, the script auto-detects a policy named
#                              PERMISSIONS_BOUNDARY_NAME (default InternSandboxBoundary)
#                              in the current account and uses it when present;
#                              otherwise no boundary is attached (normal accounts).
#   PERMISSIONS_BOUNDARY_NAME  Policy name to auto-detect (default InternSandboxBoundary).
# ---------------------------------------------------------------------------
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/.." && pwd)"
TEMPLATE="$HERE/cloudformation/quant-trader-prep.yaml"

STACK_NAME="${STACK_NAME:-quant-trader-prep}"
PROJECT_NAME="${PROJECT_NAME:-quant-trader-prep}"
AWS_REGION="${AWS_REGION:-$(aws configure get region 2>/dev/null || echo us-east-1)}"
CALLBACK_URLS="${CALLBACK_URLS:-http://localhost:5173/,http://localhost:4173/}"
LOGOUT_URLS="${LOGOUT_URLS:-$CALLBACK_URLS}"
GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}"
GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-}"
ENV_OUT="${ENV_OUT:-$REPO_ROOT/.env.local}"

# ---- IAM permissions boundary (for restricted / sandbox accounts). ----------
# If PERMISSIONS_BOUNDARY_ARN is unset, auto-detect a boundary policy named
# PERMISSIONS_BOUNDARY_NAME in the current account and use it when it exists.
# This keeps normal accounts untouched while making sandbox deploys "just work".
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

echo "==> Deploying '$STACK_NAME' to region '$AWS_REGION'"
[ -n "$GOOGLE_CLIENT_ID" ] && echo "    Google federation: ON" || echo "    Google federation: OFF (username/email only)"
[ -n "$PERMISSIONS_BOUNDARY_ARN" ] && echo "    Permissions boundary: $PERMISSIONS_BOUNDARY_ARN" || echo "    Permissions boundary: none"

aws cloudformation deploy \
  --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" \
  --template-file "$TEMPLATE" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    ProjectName="$PROJECT_NAME" \
    CallbackUrls="$CALLBACK_URLS" \
    LogoutUrls="$LOGOUT_URLS" \
    GoogleClientId="$GOOGLE_CLIENT_ID" \
    GoogleClientSecret="$GOOGLE_CLIENT_SECRET" \
    PermissionsBoundaryArn="$PERMISSIONS_BOUNDARY_ARN"

echo "==> Reading stack outputs"
get_out() {
  aws cloudformation describe-stacks \
    --region "$AWS_REGION" \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" \
    --output text
}

REGION="$(get_out Region)"
USER_POOL_ID="$(get_out UserPoolId)"
USER_POOL_CLIENT_ID="$(get_out UserPoolClientId)"
IDENTITY_POOL_ID="$(get_out IdentityPoolId)"
COGNITO_DOMAIN="$(get_out CognitoDomain)"
PROGRESS_TABLE="$(get_out ProgressTableName)"
API_BASE_URL="$(get_out ApiBaseUrl)"

# The redirect URI must be one of the registered CallbackUrls. Use the first.
REDIRECT_URI="${CALLBACK_URLS%%,*}"

# Google sign-in is available ONLY when we deployed with a Google client id
# (the same path that creates the Google IdP in the pool). Emit VITE_GOOGLE_AUTH
# accordingly so the "Continue with Google" button appears iff Google truly
# exists — and stays hidden otherwise (no broken Hosted UI screen).
if [ -n "$GOOGLE_CLIENT_ID" ]; then
  GOOGLE_AUTH="on"
else
  GOOGLE_AUTH="off"
fi

echo "==> Writing $ENV_OUT"
cat > "$ENV_OUT" <<EOF
# Generated by infra/deploy.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# Turns the app onto the AWS backend. Delete this file (or set
# VITE_STORAGE_BACKEND=local) to return to the local-first default.
VITE_STORAGE_BACKEND=aws
VITE_AWS_REGION=$REGION
VITE_COGNITO_USER_POOL_ID=$USER_POOL_ID
VITE_COGNITO_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
VITE_COGNITO_IDENTITY_POOL_ID=$IDENTITY_POOL_ID
VITE_DYNAMODB_TABLE=$PROGRESS_TABLE
VITE_GOOGLE_AUTH=$GOOGLE_AUTH
VITE_COGNITO_DOMAIN=$COGNITO_DOMAIN
VITE_COGNITO_REDIRECT_URI=$REDIRECT_URI
VITE_API_BASE_URL=$API_BASE_URL
EOF

echo ""
echo "==> Done. Wrote env to: $ENV_OUT"
echo "    Restart the dev server (npm run dev) to pick it up."
echo ""
cat "$ENV_OUT"
