#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Quant Trader Prep — PRODUCTION frontend build (points the bundle at the
# HOSTED AWS AI endpoint, never localhost).
#
# WHY THIS EXISTS
#   `npm run build` alone bakes whatever `VITE_AI_ENDPOINT` is in the developer's
#   .env.local — which is `http://localhost:8788` for local real-LLM dev. Shipping
#   that to prod makes every real browser POST to localhost, fail instantly, and
#   silently fall back to the deterministic keyword highlighter (tiny/random
#   highlights, "instant" grading). Vite's env precedence is
#     .env.[mode].local > .env.local > .env.[mode] > .env
#   so a committed `.env.production` would LOSE to the dev's `.env.local`. The only
#   robust override is a real OS env var (highest precedence), which is what this
#   script sets — WITHOUT mutating .env.local (local dev keeps localhost).
#
# USAGE
#   ./infra/build-prod.sh                 # resolves the AI endpoint from the AI stack
#   AI_ENDPOINT=https://xxxx.execute-api.us-east-1.amazonaws.com ./infra/build-prod.sh
#   AWS_PROFILE=sbsandbox ./infra/build-prod.sh
#
# It then GREP-scans dist/ to PROVE the bundle points at the AWS endpoint, does
# NOT contain localhost:8788, and carries NO secrets — failing the build if not.
# ---------------------------------------------------------------------------
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/.." && pwd)"

AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_PROFILE="${AWS_PROFILE:-sbsandbox}"
AI_STACK_NAME="${AI_STACK_NAME:-quant-trader-prep-ai}"
AI_PROVIDER="${VITE_AI_PROVIDER:-openai}"

# ---- 1. Resolve the hosted AI endpoint (base URL; client POSTs to ${base}/ai).
AI_ENDPOINT="${AI_ENDPOINT:-}"
if [ -z "$AI_ENDPOINT" ]; then
  echo "==> Resolving AI endpoint from stack '$AI_STACK_NAME' (profile $AWS_PROFILE)"
  AI_ENDPOINT="$(AWS_PROFILE="$AWS_PROFILE" aws cloudformation describe-stacks \
    --region "$AWS_REGION" --stack-name "$AI_STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='AiEndpoint'].OutputValue" \
    --output text 2>/dev/null || true)"
fi
if [ -z "$AI_ENDPOINT" ] || [ "$AI_ENDPOINT" = "None" ]; then
  echo "ERROR: could not resolve the AI endpoint. Pass AI_ENDPOINT=… explicitly." >&2
  exit 1
fi
case "$AI_ENDPOINT" in
  *localhost*|*127.0.0.1*)
    echo "ERROR: refusing to build prod with a localhost AI endpoint ($AI_ENDPOINT)." >&2
    exit 1 ;;
esac
echo "    AI endpoint: $AI_ENDPOINT"

# ---- 2. Build with the prod endpoint injected as a real OS env var (wins over
#         .env.local). Local dev's .env.local is left untouched.
echo "==> Building prod bundle"
( cd "$REPO_ROOT" && \
  VITE_AI_LAYER=on \
  VITE_AI_PROVIDER="$AI_PROVIDER" \
  VITE_AI_ENDPOINT="$AI_ENDPOINT" \
  npm run build )

DIST="$REPO_ROOT/dist"

# ---- 3. Prove the bundle is correct: has the AWS endpoint, no localhost:8788.
echo "==> Verifying dist wiring"
if ! grep -rq "$AI_ENDPOINT" "$DIST"; then
  echo "ERROR: dist does not contain the AWS AI endpoint — build did not pick it up." >&2
  exit 1
fi
if grep -rq "localhost:8788" "$DIST"; then
  echo "ERROR: dist STILL contains localhost:8788 — prod override failed." >&2
  grep -rl "localhost:8788" "$DIST" >&2 || true
  exit 1
fi
echo "    OK: dist points at the AWS AI endpoint and contains no localhost:8788."

# ---- 4. Secret scan: no provider keys or AWS creds ever in the client bundle.
echo "==> Scanning dist for secrets"
# Match REAL key shapes (long runs) so minified tokens like a "sk-d" CSS
# fragment don't false-positive: provider keys are 20+ chars after the prefix.
SECRET_PATTERNS='tfy_[A-Za-z0-9]{16,}|maat_[A-Za-z0-9]{16,}|sk-[A-Za-z0-9_-]{20,}|AI_PROVIDER_API_KEY|(AKIA|ASIA)[A-Z0-9]{16}'
if grep -rEq "$SECRET_PATTERNS" "$DIST"; then
  echo "ERROR: potential secret found in dist — aborting." >&2
  grep -rEl "$SECRET_PATTERNS" "$DIST" >&2 || true
  exit 1
fi
# Also scan for the LITERAL key value from .env.local (never printed), if present.
if [ -f "$REPO_ROOT/.env.local" ]; then
  KEYVAL="$(grep -E '^AI_PROVIDER_API_KEY=' "$REPO_ROOT/.env.local" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs || true)"
  if [ -n "$KEYVAL" ] && grep -rqF "$KEYVAL" "$DIST"; then
    echo "ERROR: the provider API key value leaked into dist — aborting." >&2
    exit 1
  fi
fi
echo "    OK: no secrets in dist."

echo ""
echo "==> Prod build complete: $DIST (AI endpoint = $AI_ENDPOINT)"
