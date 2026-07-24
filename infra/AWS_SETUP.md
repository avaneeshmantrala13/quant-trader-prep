# AWS Free-Tier Backend — USER RUNBOOK

This is the exact, ordered set of steps **you** run to give Quant Trader Prep
real accounts + cross-device progress sync on the **AWS Free Tier**. Everything
here is Free-Tier-safe: on-demand DynamoDB, Cognito's always-free MAU tier, and
the Lambda + API Gateway free request budget. **No provisioned capacity, no paid
tiers, no paid AI services.**

> The app still runs **100% local-first with no AWS at all** — you only need
> this to turn on cloud accounts + sync.

**Prerequisites**
- AWS CLI installed and configured (`aws configure` — access key, secret, a
  default region like `us-east-1`). Verify with:
  ```bash
  aws sts get-caller-identity
  ```
- Node/npm (already used to run the app).

---

## TL;DR (the fast path)

```bash
# from the repo root: /Users/avaneeshmantrala/Desktop/alphaAiProjects/quant-trader-prep
./infra/deploy.sh                 # creates everything, writes .env.local for you
npm install                       # (only if you haven't already)
npm run dev                       # app now uses Cognito + DynamoDB
```

`deploy.sh` provisions the whole stack and writes a ready-to-use `.env.local`.
Google sign-in is optional and added later (Step 4). The rest of this doc is the
explicit, copy-pasteable version of that one command, plus the Google setup.

---

## Restricted / sandbox accounts (IAM permissions boundary)

Some accounts (e.g. the intern **sandbox**) attach an IAM **permissions boundary**
that **denies `iam:CreateRole` unless the new role carries that same boundary**.
Without it, `deploy.sh` fails during resource creation and rolls back with:

```
... is not authorized to perform: iam:CreateRole on resource: .../role/quant-trader-prep-...
with an explicit deny in a permissions boundary: arn:aws:iam::<acct>:policy/InternSandboxBoundary
```

**You almost certainly don't need to do anything** — `deploy.sh` / `deploy-ai.sh`
**auto-detect** a boundary policy named `InternSandboxBoundary` in your account and
attach it to every role they create. So in the sandbox the plain command just works:

```bash
./infra/deploy.sh
```

To point at a different boundary (or force one), set the env var explicitly:

```bash
PERMISSIONS_BOUNDARY_ARN="arn:aws:iam::<acct>:policy/YourBoundary" ./infra/deploy.sh
```

- Override the auto-detected policy **name** with `PERMISSIONS_BOUNDARY_NAME=...`.
- On normal accounts (no such policy) nothing is attached — behavior is unchanged.
- Under the hood this passes the `PermissionsBoundaryArn` template parameter, which
  every `AWS::IAM::Role` in the templates honors via a `PermissionsBoundary` property
  (guarded by the `HasPermissionsBoundary` condition — blank = no boundary).

> If your sandbox boundary **unconditionally** denies `iam:CreateRole` (not just
> "unless the boundary is attached"), no template change can help — ask an admin to
> grant the permission or pre-provision the roles.

---

## Step 1 — Deploy the backend (Cognito + DynamoDB + Lambda/API Gateway)

**Option A — the script (recommended):**
```bash
./infra/deploy.sh
```

**Option B — the raw AWS CLI (identical result):**
```bash
aws cloudformation deploy \
  --region us-east-1 \
  --stack-name quant-trader-prep \
  --template-file infra/cloudformation/quant-trader-prep.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    ProjectName=quant-trader-prep \
    CallbackUrls="http://localhost:5173/,http://localhost:4173/" \
    LogoutUrls="http://localhost:5173/,http://localhost:4173/"
    # In a restricted/sandbox account, also add (see "Restricted / sandbox accounts"):
    #   PermissionsBoundaryArn="arn:aws:iam::<acct>:policy/InternSandboxBoundary"
```

This creates, in one stack:
- **Cognito User Pool** (`quant-trader-prep-users`) — username sign-in **with an
  email alias**, 6-char-minimum password (matches the app), and a **PreSignUp
  auto-confirm** Lambda so "create account & enter" works with no emailed code
  (same UX as local; see the production note in Step 6).
- **Cognito User Pool App Client** (`quant-trader-prep-web`) — public SPA client
  (no secret), password + SRP + refresh auth flows, OAuth code flow enabled.
- **Cognito User Pool Domain** — the Hosted-UI domain used for Google.
- **Cognito Identity Pool** — exchanges the user-pool JWT for **temporary,
  fine-grained AWS credentials** (no long-lived keys in the browser).
- **DynamoDB `quant-trader-prep-progress`** — on-demand (`PAY_PER_REQUEST`),
  one **owner-scoped** item per user (partition key `userId`).
- **DynamoDB `quant-trader-prep-firm-format-reports`** — **server-only** table
  (the client role has zero access; only the API Lambda can write it).
- **IAM authenticated role** — can only `GetItem/PutItem/...` the progress row
  whose key equals the caller's own identity (`dynamodb:LeadingKeys`).
- **Lambda `quant-trader-prep-api` + HTTP API Gateway** — skeleton for
  privileged/server-only writes, protected by a **native Cognito JWT authorizer**.

## Step 2 — Capture the IDs (stack outputs)

If you used `deploy.sh`, it already wrote `.env.local` — skip to Step 3.
Otherwise, read the outputs:

```bash
aws cloudformation describe-stacks \
  --region us-east-1 \
  --stack-name quant-trader-prep \
  --query "Stacks[0].Outputs" --output table
```

You will get (Output key → the env var it maps to):

| Output key | Env var |
|---|---|
| `Region` | `VITE_AWS_REGION` |
| `UserPoolId` | `VITE_COGNITO_USER_POOL_ID` |
| `UserPoolClientId` | `VITE_COGNITO_USER_POOL_CLIENT_ID` |
| `IdentityPoolId` | `VITE_COGNITO_IDENTITY_POOL_ID` |
| `ProgressTableName` | `VITE_DYNAMODB_TABLE` |
| `CognitoDomain` | `VITE_COGNITO_DOMAIN` (Google only) |
| `ApiBaseUrl` | `VITE_API_BASE_URL` (privileged API) |

## Step 3 — Point the app at AWS (`.env.local`)

`deploy.sh` writes this for you. To do it by hand, copy `.env.example` to
`.env.local` and fill in the values from Step 2:

```bash
cp .env.example .env.local
# then edit .env.local
```

**Every env var the app reads:**

| Variable | Required? | What it is |
|---|---|---|
| `VITE_STORAGE_BACKEND` | **yes** — set to `aws` | `local` (default) or `aws` |
| `VITE_AWS_REGION` | **yes** | e.g. `us-east-1` |
| `VITE_COGNITO_USER_POOL_ID` | **yes** | Cognito User Pool ID |
| `VITE_COGNITO_USER_POOL_CLIENT_ID` | **yes** | App Client ID |
| `VITE_COGNITO_IDENTITY_POOL_ID` | **yes** | Identity Pool ID |
| `VITE_DYNAMODB_TABLE` | **yes** | Progress table name |
| `VITE_GOOGLE_AUTH` | only for Google | `on` shows the "Continue with Google" button; default `off` hides it. `deploy.sh` sets this automatically (`on` only when you pass `GOOGLE_CLIENT_ID`). |
| `VITE_COGNITO_DOMAIN` | only for Google | Hosted-UI domain |
| `VITE_COGNITO_REDIRECT_URI` | only for Google | must match a registered callback URL (e.g. `http://localhost:5173/`) |
| `VITE_API_BASE_URL` | optional | API Gateway URL for privileged writes |

> If `VITE_STORAGE_BACKEND=aws` but a **required** var is missing, the app logs a
> warning and safely falls back to local storage — it never hard-crashes.

Then:
```bash
npm run dev     # username/email accounts + DynamoDB sync are now live
```

Test it: create an account on one browser, earn some XP, then log in with the
same account in another browser/profile — your progress follows you.

---

## Step 4 — (Optional) Turn on "Continue with Google"

Google federation needs a Google OAuth client, so it's a separate opt-in step.
Until you complete it, the **"Continue with Google" button is hidden** (the app
gates it on `VITE_GOOGLE_AUTH=on`, which `deploy.sh` only writes when you deploy
with a `GOOGLE_CLIENT_ID`). This is deliberate: a Cognito Hosted-UI domain always
exists even with no Google IdP, so a stray Google button would send users to the
Hosted UI's error screen — *"Login option is not available. Please try another
one."* Hiding it until Google truly exists avoids that entirely.

> **Note on the flow:** Google sign-in inherently redirects through **Cognito's
> Hosted UI** (`/oauth2/authorize?identity_provider=Google`), which then shows
> **Google's own consent screen** — that hand-off is normal and expected. The
> Cognito page itself can only be *lightly* branded via User Pool → **Hosted UI
> customization** (logo + CSS); it can't be replaced with your own React UI.
> Restyling it is out of scope here.

**4a. Create the Google OAuth client**
1. Go to <https://console.cloud.google.com/apis/credentials> → **Create
   Credentials → OAuth client ID → Web application**.
2. **Authorized JavaScript origins:** your app origin(s), e.g.
   `http://localhost:5173`.
3. **Authorized redirect URIs:** the Cognito Hosted-UI callback — use your
   `CognitoDomain` output:
   ```
   https://<CognitoDomain>/oauth2/idpresponse
   ```
   e.g. `https://quant-trader-prep-123456789012.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`
4. Copy the **Client ID** and **Client secret**.

**4b. Re-deploy the stack with the Google values**
```bash
GOOGLE_CLIENT_ID="<your-google-client-id>" \
GOOGLE_CLIENT_SECRET="<your-google-client-secret>" \
./infra/deploy.sh
```
or with the raw CLI, add:
```
    GoogleClientId="<...>" GoogleClientSecret="<...>"
```
to the `--parameter-overrides` list.

**4c. Set the Google env vars** (deploy.sh writes all three automatically when
you pass `GOOGLE_CLIENT_ID`):
```
VITE_GOOGLE_AUTH=on
VITE_COGNITO_DOMAIN=<CognitoDomain output>
VITE_COGNITO_REDIRECT_URI=http://localhost:5173/
```
Restart `npm run dev`. A **"Continue with Google"** button now appears on the
login page. It stays hidden entirely on the local backend, and on any AWS
deployment where `VITE_GOOGLE_AUTH` is `off`/unset (i.e. deployed without a
Google client id).

> When you deploy to a real domain (e.g. Vercel), add that URL to both
> `CallbackUrls`/`LogoutUrls` (re-deploy) and to the Google client's origins +
> redirect URIs, and set `VITE_COGNITO_REDIRECT_URI` to that URL.

---

## Step 5 — Free-Tier safety (what you're using and the limits)

| Service | Free-Tier allotment | How we stay under it |
|---|---|---|
| **Cognito User Pools** | 50,000 MAU always free | Pilot cohort ≪ 50k. |
| **DynamoDB** | 25 GB storage + 25 WCU/25 RCU **or** the on-demand always-free requests | Table is **on-demand** (`PAY_PER_REQUEST`) — no provisioned capacity. One tiny item/user; reads on login, writes are **debounced twice** (ProgressContext 250 ms + provider 1.5 s) so a whole study session is a handful of writes. |
| **Lambda** | ~1M requests + 400k GB-s/month always free | Progress sync uses **DynamoDB directly** (no Lambda); the API Lambda is only for privileged writes → negligible volume. |
| **API Gateway (HTTP API)** | 1M requests/month for 12 months | Same — only privileged calls hit it. |
| **Data transfer** | Free-tier egress | Tiny JSON payloads. |

**Why writes stay tiny:** progress saves are debounced in `ProgressContext`
(250 ms) *and* again in the AWS provider (1.5 s), and each save is a single
`PutItem` of one small blob. A typical multi-hour session is on the order of
tens of writes, not thousands — orders of magnitude under the free tier.

---

## Step 6 — Production hardening (decide later)

- **Email verification:** the default stack **auto-confirms** sign-ups (no
  emailed code) to mirror the local UX. For production, disable the PreSignUp
  auto-confirm (remove `LambdaConfig.PreSignUp` from the template, or delete the
  trigger in the Cognito console) so users must verify their email; the app
  already supports the code flow via `confirmSignUp`.
- **Custom domain / hosting:** if you host the frontend (e.g. Vercel), add its
  URL to `CallbackUrls`/`LogoutUrls` and to the Google client, and update
  `VITE_COGNITO_REDIRECT_URI`.
- **Password policy:** currently 6 chars min, no complexity (matches the app).
  Tighten in `UserPool.Policies.PasswordPolicy` if desired.

---

## Teardown

Removes every resource in the stack (DynamoDB data included — export first if
you care about it):
```bash
aws cloudformation delete-stack --region us-east-1 --stack-name quant-trader-prep
```
