# `infra/` — AWS Free-Tier backend

Infrastructure-as-code for Quant Trader Prep's optional cloud backend
(Amazon Cognito + DynamoDB + Lambda/API Gateway). The app is **local-first by
default**; this only matters when you want real accounts + cross-device sync.

## Contents

| File | What it is |
|---|---|
| [`AWS_SETUP.md`](./AWS_SETUP.md) | **The USER runbook** — exact ordered steps + every env var. Start here. |
| [`cloudformation/quant-trader-prep.yaml`](./cloudformation/quant-trader-prep.yaml) | One CloudFormation template that provisions the whole stack (inline Lambda code — no S3/SAM CLI needed). |
| [`deploy.sh`](./deploy.sh) | One-command deploy: runs `aws cloudformation deploy`, reads the outputs, and writes a filled-in `.env.local`. |

## Quick start

```bash
./infra/deploy.sh      # deploy + auto-write .env.local
npm run dev            # app now uses Cognito + DynamoDB
```

Full details, Google sign-in, env vars, Free-Tier limits, and teardown are in
[`AWS_SETUP.md`](./AWS_SETUP.md).

## Architecture (PRD §10)

```
Browser (React SPA)
  ├─ Cognito User Pool  ──▶ sign-up / sign-in (username · email alias · Google)
  ├─ Cognito Identity Pool ──▶ temporary, fine-grained AWS creds (no secrets shipped)
  │        └─▶ DynamoDB (owner-scoped): read/write ONLY your own progress item
  └─ Cognito JWT ──▶ API Gateway (HTTP, JWT authorizer) ──▶ Lambda
                          └─▶ DynamoDB privileged/server-only tables
```

## Security model

- **Owner-scoped reads/writes.** The authenticated IAM role can only touch the
  DynamoDB item whose partition key equals the caller's own Cognito identity id,
  enforced by a `dynamodb:LeadingKeys` condition. One user physically cannot read
  or write another user's row.
- **No client secrets.** The browser never holds long-lived AWS keys — it gets
  short-lived, scoped credentials from the Identity Pool. The Google client
  secret lives only in Cognito (set at deploy time), never in the app bundle.
- **Server-only privileged writes.** The `firm-format-reports` table (and any
  future scored-attempts / quota tables) is writable **only** by the API Lambda,
  not by the client role — matching the PRD's "Lambda/IAM-only" data classes.
- **JWT-authorized API.** Every API Gateway route requires a valid Cognito
  access token, verified natively by the HTTP API JWT authorizer.
