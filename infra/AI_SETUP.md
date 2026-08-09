# Optional AI "flavor / open-ended" layer — USER RUNBOOK

> **Just want the real LLM grader on right now?** See
> [`AI_ENABLE.md`](./AI_ENABLE.md) for the short **localhost-now / AWS-later**
> runbook (a local `npm run ai:dev` server keeps your key server-side). This file
> is the full AWS design + cost/safety reference.

This is the exact, ordered set of steps **you** run to switch on the optional
LLM layer that sits **on top of** the parametric generators + exact solvers.

**What it is (and isn't).** The parametric generators + exact solvers stay the
**source of truth** for correctness. The LLM is an OPTIONAL layer that:

- **Flavor mode (primary, fully verifiable):** reskins ONLY the narrative of an
  already-generated question — same numbers, same answer, same options. A
  numeric **guardrail** confirms the math survived the rewrite; if it didn't, we
  discard the LLM text and show the original. **Zero correctness risk.**
- **Open-ended mode (secondary, conservative):** proposes a brand-new question,
  surfaced as a flashcard **explicitly labeled "AI-generated — not
  verifier-checked"** and **never auto-graded**.

**It is OFF BY DEFAULT.** With no config the app builds/runs 100% local-first,
there is **no LLM code in the browser bundle**, and no button appears.

> ⚠️ **Cost note up front:** the AWS pieces here (Lambda, HTTP API, a tiny
> on-demand DynamoDB quota table) are Free-Tier-friendly, **but the LLM API
> itself (OpenAI/Anthropic) is an EXTERNAL, PAID service — NOT part of the AWS
> Free Tier.** It is the only paid piece. See [§5](#step-5--cost--rate-limits-read-this).

**Prerequisites**

- You already deployed the main backend: [`AWS_SETUP.md`](./AWS_SETUP.md) →
  `./infra/deploy.sh`. That stack (`quant-trader-prep`) provides the Cognito User
  Pool this layer authenticates against.
- AWS CLI configured (`aws sts get-caller-identity` works).
- An OpenAI **or** Anthropic account — **or** a **TrueFoundry AI Gateway** token
  (an OpenAI-compatible gateway; see [§3b](#step-3b--truefoundry-ai-gateway-openai-compatible)).

---

## TL;DR (the fast path)

```bash
# 0. main stack already deployed via ./infra/deploy.sh

# 1. store your LLM key in SSM (SecureString) — pick ONE provider:
aws ssm put-parameter \
  --name /quant-trader-prep/ai/api-key \
  --type SecureString \
  --value "sk-REPLACE_WITH_YOUR_OPENAI_KEY"

# 2. deploy the AI stack + upload the Lambda + write env vars:
./infra/deploy-ai.sh            # OpenAI default, 50 calls/user/day

# 3. run it
npm run dev                     # the "✨ Fresh variant" action can now appear
```

The rest of this doc is the explicit version of those three commands.

---

## Step 1 — Get an API key

**OpenAI (default):**
1. Go to <https://platform.openai.com/api-keys>, sign in.
2. **Create new secret key**, copy it (starts with `sk-...`).
3. Add a little credit / a budget under **Billing** (recommended: set a hard
   monthly limit — see [§5](#step-5--cost--rate-limits-read-this)).

**Anthropic (alternative):**
1. Go to <https://console.anthropic.com/settings/keys>, sign in.
2. **Create Key**, copy it (starts with `sk-ant-...`).
3. Set a spend limit under **Plans & Billing**.

**TrueFoundry AI Gateway (OpenAI-compatible, alternative):**
1. Open your TrueFoundry dashboard → **Playground** (or **Personal Access
   Tokens** / **Virtual Account Tokens**) and create a **PAT** or **VAT**. This is
   a *TrueFoundry* token, **not** a provider (OpenAI/Anthropic) key.
2. Note your gateway **base URL**: `https://gateway.truefoundry.ai` for SaaS, or
   your own gateway URL (shown in the Playground) for a self-hosted deployment.
3. From the Playground, copy the **model id** in `provider_account/model_name`
   form (e.g. `openai-main/gpt-4o-mini`).

You only need **one** path. OpenAI is the default; Anthropic is Step 3;
TrueFoundry is [Step 3b](#step-3b--truefoundry-ai-gateway-openai-compatible).

---

## Step 2 — Store the key in SSM Parameter Store (SecureString)

The key lives **only** here — never in the browser bundle, never in
CloudFormation. The Lambda reads it at runtime with `ssm:GetParameter`.

```bash
aws ssm put-parameter \
  --name /quant-trader-prep/ai/api-key \
  --type SecureString \
  --value "sk-REPLACE_WITH_YOUR_KEY"
```

Rotating later? Overwrite it (the Lambda picks it up on its next cold start):

```bash
aws ssm put-parameter \
  --name /quant-trader-prep/ai/api-key \
  --type SecureString --overwrite \
  --value "sk-NEW_KEY"
```

> The parameter **name** (`/quant-trader-prep/ai/api-key`) is exactly what the
> Lambda reads (its `AI_SSM_PARAM` env var). If you change the name, pass
> `AI_SSM_PARAM=/your/name` to `deploy-ai.sh` in Step 3.

---

## Step 3 — Deploy the AI Lambda + endpoint

This creates a **separate, additive** CloudFormation stack
(`quant-trader-prep-ai`) — it does **not** touch the working auth/data stack.
It stands up its own Lambda + API Gateway HTTP API + Cognito **JWT authorizer**
(pointed at your EXISTING User Pool), then uploads the real handler code and
appends the client env vars to `.env.local`.

**Option A — the script (recommended):**
```bash
./infra/deploy-ai.sh
```

Switch provider/model or quota with env vars:
```bash
AI_PROVIDER=anthropic AI_MODEL=claude-3-5-haiku-latest DAILY_QUOTA=25 \
  ./infra/deploy-ai.sh
```

**Option B — the raw AWS CLI (equivalent):**
```bash
# read the existing pool ids from the main stack:
UP=$(aws cloudformation describe-stacks --stack-name quant-trader-prep \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)
CL=$(aws cloudformation describe-stacks --stack-name quant-trader-prep \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" --output text)

aws cloudformation deploy \
  --stack-name quant-trader-prep-ai \
  --template-file infra/cloudformation/quant-trader-prep-ai.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides UserPoolId="$UP" UserPoolClientId="$CL" \
    AiProvider=openai AiModel=gpt-4o-mini DailyQuota=50

# upload the real Lambda code (the template ships a fail-safe placeholder).
# NOTE: ship BOTH index.mjs AND core.mjs — index.mjs imports the shared router
# from core.mjs (the same module the local dev server uses):
FN=$(aws cloudformation describe-stacks --stack-name quant-trader-prep-ai \
  --query "Stacks[0].Outputs[?OutputKey=='AiFunctionName'].OutputValue" --output text)
( cd infra/lambda/ai-flavor && zip -q -r /tmp/ai.zip index.mjs core.mjs )
aws lambda update-function-code --function-name "$FN" --zip-file fileb:///tmp/ai.zip
```

This provisions:
- **AI Lambda** (`quant-trader-prep-ai`) — reads the SSM key, calls the LLM,
  runs the server-side guardrail. Uses the runtime-bundled AWS SDK + global
  `fetch`, so **no npm packaging** is needed.
- **HTTP API + JWT authorizer** — every call requires a valid Cognito token from
  your existing User Pool.
- **`quant-trader-prep-ai-quota`** DynamoDB table (on-demand, TTL) — the
  per-user daily counter.

**To switch providers later**, just re-run with `AI_PROVIDER=anthropic` (and put
an Anthropic key in SSM). The Lambda has both providers implemented; the env var
selects one.

---

## Step 3b — TrueFoundry AI Gateway (OpenAI-compatible)

TrueFoundry is an **OpenAI-compatible** LLM gateway: same `POST /chat/completions`
request/response as OpenAI, you just change the **base URL** + **key** + **model
id**. So this reuses the Lambda's OpenAI path — no code branch of its own — via
two env vars: `AI_BASE_URL` (the gateway) and `AI_MODEL` (the gateway's model id).
The Lambda sends `Authorization: Bearer <token-from-SSM>`, so you store your
**TrueFoundry PAT/VAT** in the **same** SSM parameter used for a raw key.

**1. Store your TrueFoundry token in SSM** (same parameter, same command as
Step 2 — it's a Bearer token either way):

```bash
aws ssm put-parameter \
  --name /quant-trader-prep/ai/api-key \
  --type SecureString --overwrite \
  --value "tfy-REPLACE_WITH_YOUR_TRUEFOUNDRY_PAT_OR_VAT"
```

**2. Deploy pointing the OpenAI-compatible path at TrueFoundry.** Set
`AI_BASE_URL` to your gateway and `AI_MODEL` to the `provider_account/model_name`
id from the Playground:

```bash
# SaaS gateway:
AI_BASE_URL=https://gateway.truefoundry.ai \
AI_MODEL=openai-main/gpt-4o-mini \
  ./infra/deploy-ai.sh

# Self-hosted gateway (use YOUR base URL from the Playground):
AI_BASE_URL=https://<your-truefoundry-gateway> \
AI_MODEL=<provider_account/model_name> \
  ./infra/deploy-ai.sh
```

Notes:
- **Model id format is `provider_account/model_name`** (e.g.
  `openai-main/gpt-4o-mini`) — copy the exact id from the TrueFoundry Playground.
- `AI_PROVIDER` stays `openai` (the default). You may set it to
  `openai-compatible` for clarity; both behave identically. Do **not** set
  `anthropic` — that uses Anthropic's native (non-OpenAI) API.
- The base URL is joined robustly: `https://gateway.truefoundry.ai` →
  `https://gateway.truefoundry.ai/chat/completions`, while the raw-OpenAI default
  `https://api.openai.com/v1` → `.../v1/chat/completions`. Setting a base that
  already ends in `/chat/completions` is also accepted (no doubling).
- With **no** `AI_BASE_URL`/`AI_MODEL` overrides you get the unchanged raw-OpenAI
  behavior. Nothing about the numeric guardrail or per-user quota changes.

---

## Step 4 — Set the client env vars

`deploy-ai.sh` **appends these for you** to `.env.local`:

```dotenv
VITE_AI_LAYER=on
VITE_AI_ENDPOINT=https://XXXX.execute-api.us-east-1.amazonaws.com
VITE_AI_PROVIDER=openai
```

If you're wiring things by hand, add the same three lines (see
[`.env.example`](../.env.example)). Then restart the dev server:

```bash
npm run dev
```

- Set `VITE_AI_LAYER=off` (or delete the lines) to turn the layer back off — the
  app instantly returns to the pure parametric backbone, no button.
- **Local dev with no key/endpoint:** set `VITE_AI_LAYER=on` **and**
  `VITE_AI_STUB=on` to exercise the UI wiring — the client skips the network and
  returns the original prompt unchanged (never a wrong answer).

---

## Step 5 — Cost & rate limits (READ THIS)

**The LLM API is the only paid piece and is NOT AWS Free-Tier.** Everything else
(Lambda invocations, HTTP API requests, the tiny DynamoDB quota table) sits
comfortably in the AWS Free Tier at pilot scale.

Cap spend at **three** layers:

1. **Provider budget (the hard cap).** In the OpenAI/Anthropic console set a
   **monthly hard limit** (e.g. \$5–\$10). This is your real backstop.
2. **Per-user daily quota (built in).** The Lambda enforces `DAILY_QUOTA` calls
   per authenticated user per day via a DynamoDB conditional counter (default
   **50**; the client also sends the Cognito `sub`). Tune it:
   ```bash
   DAILY_QUOTA=25 ./infra/deploy-ai.sh     # lower the cap
   DAILY_QUOTA=0  ./infra/deploy-ai.sh     # disable the quota check
   ```
3. **Cheap model + short outputs.** The defaults (`gpt-4o-mini` /
   `claude-3-5-haiku`) are inexpensive; flavor prompts are tiny (a reskin of one
   question). Expect fractions of a cent per call.

Rough order of magnitude: a reskin is a few hundred tokens in/out → typically
**well under \$0.001** per call on the default models. A 50/user/day quota with a
handful of pilot users is a few cents a day — but **the provider hard limit is
what guarantees you never overspend.**

**Teardown** (removes only the AI layer; the main stack is untouched):
```bash
aws cloudformation delete-stack --stack-name quant-trader-prep-ai
aws ssm delete-parameter --name /quant-trader-prep/ai/api-key
```

---

## How the safety model works (why a wrong answer can't surface)

- **The LLM never computes or grades an answer.** In flavor mode the solver's
  answer, options, distractors, and explanation are kept verbatim by the client;
  the LLM only rewrites the prompt's story.
- **Verifier gate (defense in depth).** The reskinned prompt must pass a numeric
  guardrail (`verifyFlavor` in `src/lib/aiFlavor.ts`, mirrored server-side in the
  Lambda): every required quantity must still be present and — strict by default
  — no new number may be introduced. On failure the LLM text is **discarded** and
  the original parametric prompt is shown. A rejection costs only variety, never
  correctness.
- **Open-ended items are never trusted as truth.** They're surfaced as
  self-assess flashcards, labeled "AI-generated — not verifier-checked", and are
  never scored.
- **Key isolation.** The API key lives only in SSM (SecureString); the Lambda
  reads it server-side. The browser bundle contains no key and no LLM SDK.
