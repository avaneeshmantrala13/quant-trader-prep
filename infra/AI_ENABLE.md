# Turn on the REAL LLM grader — localhost NOW, AWS later

This is the short, copy-pasteable runbook for switching the reasoning grader from
its deterministic floor to the **real LLM** — first on **localhost** (works
today, no AWS), then on the **AWS site** (when the deploy lockdown lifts).

The heavy design lives in [`AI_SETUP.md`](./AI_SETUP.md); this file is just the
two enablement paths and exactly which values you fill in.

## The one security rule (read first)

The provider API key is **server-only**. It is read from a **non-`VITE_`**
variable (`AI_PROVIDER_API_KEY`) by a server process, and it must **never** be a
`VITE_*` var — anything named `VITE_*` is compiled into the **browser bundle**
and shipped to every visitor.

| Variable | Where it lives | Exposed to browser? |
|---|---|---|
| `AI_PROVIDER_API_KEY` | `.env.local` (local) / SSM SecureString (AWS) — **server only** | **No** |
| `VITE_AI_LAYER` | `.env.local` / Amplify build env | Yes (just an on/off flag) |
| `VITE_AI_ENDPOINT` | `.env.local` / Amplify build env | Yes (just a URL) |

`.env.local` (and any `.env*.local`) is **gitignored** — never commit the key.

---

## Path A — Localhost NOW (real LLM, no AWS)

A tiny local Node server ([`scripts/ai-dev-server.mjs`](../scripts/ai-dev-server.mjs))
serves `POST /ai` using the **same** shared router the Lambda uses
([`infra/lambda/ai-flavor/core.mjs`](./lambda/ai-flavor/core.mjs)), so localhost
behavior === prod behavior for every mode.

**1. Put your key + the client on-switch in `.env.local`** (gitignored). Add:

```dotenv
# --- server-only (read by scripts/ai-dev-server.mjs; NEVER shipped to browser) ---
AI_PROVIDER_API_KEY=sk-REPLACE_WITH_YOUR_KEY   # <-- your real key (placeholder)
AI_PROVIDER=openai                             # or "anthropic"
AI_PROVIDER_MODEL=gpt-4o-mini                  # optional (or claude-3-5-haiku-latest)

# --- client (safe to expose): point the app at the LOCAL server ---
VITE_AI_LAYER=on
VITE_AI_ENDPOINT=http://localhost:8788
```

> If your `.env.local` already has `VITE_AI_ENDPOINT` pointing at the AWS API,
> change it to `http://localhost:8788` for local dev (and back for prod).

**2. Start the local AI server** (one terminal):

```bash
npm run ai:dev
```

You should see `Local AI endpoint listening on http://localhost:8788` and
`key loaded from env`. (No key → it logs a clear error and every `/ai` call
returns a 500 telling you to set `AI_PROVIDER_API_KEY`.)

**3. Start the app** (second terminal), then use the Mock Interview:

```bash
npm run dev
```

Or run both together in one terminal:

```bash
npm run dev:ai      # starts the AI server in the background + Vite
```

**What to expect:** the Mock Interview reasoning review now calls the real model
for localization + feedback (`mock-review-reasoning`) and claim extraction
(`mock-extract-claims`), while the deterministic verifier stays authoritative
(it reconciles/overrides every span). Turn it back off anytime with
`VITE_AI_LAYER=off` (instant return to the offline floor).

**Placeholders you fill:** `AI_PROVIDER_API_KEY` (your key). Everything else has
a working default. Fixed: the port default `8788` and the `/ai` path.

---

## Path B — AWS site LATER (when the lockdown lifts — do NOT deploy now)

The AWS pieces are already coded (`infra/cloudformation/quant-trader-prep-ai.yaml`
+ `infra/lambda/ai-flavor/{index,core}.mjs`). When you can deploy again:

**1. Store the key in SSM (SecureString).** The Lambda reads this exact
parameter name (its `AI_SSM_PARAM`, default below):

```bash
aws ssm put-parameter \
  --name /quant-trader-prep/ai/api-key \
  --type SecureString \
  --value "sk-REPLACE_WITH_YOUR_KEY" \
  --region us-east-1            # <-- your region/profile as needed
```

Rotate later with `--overwrite`. If you use a different name, pass
`AI_SSM_PARAM=/your/name ./infra/deploy-ai.sh`.

**2. Deploy the AI stack + upload the Lambda** (this zips **both** `index.mjs`
and `core.mjs`):

```bash
./infra/deploy-ai.sh                 # OpenAI default, 50 calls/user/day
# provider/model/quota overrides:
AI_PROVIDER=anthropic AI_MODEL=claude-3-5-haiku-latest DAILY_QUOTA=25 \
  ./infra/deploy-ai.sh
```

`deploy-ai.sh` prints the endpoint and appends the client vars to `.env.local`
for local prod-pointing. For the **hosted Amplify site**, set these **two build
env vars** in the Amplify console (App settings → Environment variables), then
redeploy:

```dotenv
VITE_AI_LAYER=on
VITE_AI_ENDPOINT=https://XXXXXXXXXX.execute-api.us-east-1.amazonaws.com   # AiEndpoint output
```

**Placeholders you fill:** the key, the region/profile, and the
`VITE_AI_ENDPOINT` URL (from the `AiEndpoint` stack output). Fixed: the SSM
parameter name (`/quant-trader-prep/ai/api-key`) and the client `/ai` path.

> The AWS Lambda requires a valid Cognito JWT (API Gateway authorizer); the
> **local** server intentionally skips auth for dev. The key never touches the
> browser in either path.

---

## Quick reference — the modes the endpoint serves

Both the local server and the Lambda route these via the shared `core.mjs`
(`AI_MODES`): `flavor`, `open-ended`, `hint`, `self-explain`,
`parse-drill-intent`, `mock-extract-claims`, `mock-review-reasoning`,
`mock-reason-grade`, `mock-clarify-grade`, `mock-followup`, `mock-diagnosis`.
See [`datasets/MOCK_AI_CONTRACT.md`](../datasets/MOCK_AI_CONTRACT.md) for the
per-mode request/response schemas.
