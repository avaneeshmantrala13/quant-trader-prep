# Google Sign-In — USER RUNBOOK

Turn on the **"Continue with Google"** button on `/login`. The client OAuth flow
(PKCE authorize redirect, token exchange, session persistence, progress
hydration) is **already fully implemented and feature-flagged off** — there is
**no app code to write**. The work here is configuration you run in your own
**Google Cloud** and **AWS** accounts, then a rebuild.

> The button stays **hidden** until Google federation truly exists: it renders
> only when `VITE_GOOGLE_AUTH=on` **and** `VITE_COGNITO_DOMAIN` +
> `VITE_COGNITO_REDIRECT_URI` are set (see `src/lib/awsConfig.ts` →
> `googleEnabled`). `infra/deploy.sh` sets all three for you when you deploy with
> a `GOOGLE_CLIENT_ID`, so you never get a broken Hosted-UI screen.

**Prerequisites**
- The AWS backend already stood up once (`./infra/deploy.sh` — see
  [`AWS_SETUP.md`](AWS_SETUP.md)). You need the stack's **CognitoDomain** output.
- A Google account with access to [Google Cloud Console](https://console.cloud.google.com/).

---

## Step 0 — get your Cognito Hosted-UI domain

If you've deployed before, read it back from the stack:

```bash
aws cloudformation describe-stacks \
  --stack-name quant-trader-prep \
  --query "Stacks[0].Outputs[?OutputKey=='CognitoDomain'].OutputValue" \
  --output text
```

It looks like `quant-trader-prep-123456789012.auth.us-east-1.amazoncognito.com`.
Call this value **`<CognitoDomain>`** below.

---

## Step 1 — create the Google OAuth client

Google Cloud Console → **APIs & Services → Credentials → Create Credentials →
OAuth client ID**.

1. Application type: **Web application**.
2. **Authorized JavaScript origins** — add each origin the app runs on (no path,
   no trailing slash):
   - `http://localhost:5173` (Vite dev)
   - `http://localhost:4173` (Vite preview) *(optional)*
   - your production origin when you deploy one (e.g. `https://app.example.com`)
3. **Authorized redirect URIs** — add the Cognito Hosted-UI callback (this is the
   Cognito domain, **not** your app URL):
   ```
   https://<CognitoDomain>/oauth2/idpresponse
   ```
4. Create, then copy the **Client ID** and **Client Secret**.

> First time using OAuth in this Google project? You may be prompted to configure
> the **OAuth consent screen** first (User type **External**, add your own email
> as a test user). The `openid email profile` scopes this app uses are
> non-sensitive, so no Google verification review is required for testing.

---

## Step 2 — redeploy the AWS stack with Google enabled

Passing a `GOOGLE_CLIENT_ID` is what actually creates the `Google` IdP in the
user pool (`GoogleIdentityProvider`, `Condition: HasGoogle`) and adds `Google` to
the app client's `SupportedIdentityProviders`.

```bash
GOOGLE_CLIENT_ID="paste-the-client-id" \
GOOGLE_CLIENT_SECRET="paste-the-client-secret" \
./infra/deploy.sh
```

`deploy.sh` then rewrites `.env.local` with the button switched on:

```
VITE_STORAGE_BACKEND=aws
VITE_GOOGLE_AUTH=on
VITE_COGNITO_DOMAIN=<CognitoDomain>
VITE_COGNITO_REDIRECT_URI=http://localhost:5173/
# …plus the required AWS backend vars
```

> **Redirect-URI must match exactly, trailing slash included.** The app sends
> `redirect_uri=http://localhost:5173/` (with the slash) on both the authorize
> redirect and the token exchange (`src/lib/awsStorage.ts`). The stack registers
> `http://localhost:5173/` and `http://localhost:4173/` as `CallbackURLs`
> (`infra/cloudformation/quant-trader-prep.yaml`), and `deploy.sh` picks the
> **first** CallbackURL as `VITE_COGNITO_REDIRECT_URI` — so they already agree. If
> you customize `CALLBACK_URLS`, keep the trailing slash and keep the app's
> redirect URI identical to one registered callback, or Cognito rejects the flow
> with `redirect_mismatch`.

The Google console's **redirect URI** (Step 1.3) points at
`https://<CognitoDomain>/oauth2/idpresponse` — that is Cognito's fixed callback,
which is **different** from the app's `VITE_COGNITO_REDIRECT_URI`. Both must be
right: Google → Cognito uses `/oauth2/idpresponse`; Cognito → app uses
`http://localhost:5173/`.

---

## Step 3 — rebuild and verify

```bash
npm run dev
```

1. Open `/login` → the **"Continue with Google"** button now appears.
2. Click it → you're bounced to Google's consent screen → back through
   `https://<CognitoDomain>/oauth2/idpresponse` → back to
   `http://localhost:5173/` **authenticated**, with the OAuth `code` scrubbed
   from the URL and your progress hydrated.

If the button does **not** appear, one of `VITE_GOOGLE_AUTH` /
`VITE_COGNITO_DOMAIN` / `VITE_COGNITO_REDIRECT_URI` is missing from `.env.local`
(re-run Step 2). If you land on a Hosted-UI page reading *"Login option is not
available"*, the `Google` IdP wasn't created — confirm you passed
`GOOGLE_CLIENT_ID` to `deploy.sh` in Step 2.

---

## What I (the assistant) did vs. what you do

- **Done in code (nothing for you to write):** the full client PKCE + redirect +
  token-exchange flow, the feature flag + `googleEnabled` gating, the
  `GoogleIdentityProvider` CloudFormation resource behind `Condition: HasGoogle`,
  the `SupportedIdentityProviders` `Fn::If`, the trailing-slash-matched
  `CallbackURLs`, and the `deploy.sh` env emission. Verified consistent
  end-to-end.
- **You run:** Step 1 (Google Cloud OAuth client) and Step 2 (`deploy.sh` with the
  Google credentials) against your own accounts, then Step 3 to verify.
