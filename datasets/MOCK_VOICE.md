# AI Mock Interview — Neural Voice (Text-to-Speech)

The AI Mock Interview reads each prompt aloud. By default the browser's **Web
Speech** `speechSynthesis` voice is robotic. This layer upgrades the spoken voice
to a **neural TTS voice** served by the app's existing AI Lambda layer (OpenAI
`gpt-4o-mini-tts`), with a **graceful Web Speech fallback** whenever the service
is off, unconfigured, offline, or errors — so a TTS failure can never break the
interview flow.

> **Going live requires a Lambda deploy.** Until `infra/deploy-ai.sh` is run (and
> the AI env vars are present), the client transparently uses the tuned Web
> Speech fallback. No app change is needed to switch over — it happens
> automatically once the endpoint is reachable.

## Client

- Owned by `src/lib/mock/speech.ts` + `src/components/mock/useMockSpeech.ts`.
- The public interface is **unchanged**: `speak(text)`, `cancelSpeech()`,
  `stopListening()`, `canSpeak`, `canListen`, etc. `MockPage.tsx` needs zero
  changes. (`prefetch(text)` is added as an optional, additive method.)
- On `speak(text)` the controller **prefers neural TTS**: it POSTs to the TTS
  endpoint, decodes the returned base64 mp3 → `Blob` → object URL, and plays it
  via an `HTMLAudioElement`.
- **Config is reused, not reinvented.** The endpoint is resolved with the SAME
  helper the AI flavor client uses — `readAiConfig()` over the `VITE_AI_*` env
  (`VITE_AI_LAYER`, `VITE_AI_ENDPOINT` / `VITE_API_BASE_URL`, `VITE_AI_STUB`).
  Neural TTS is used only when `VITE_AI_LAYER=on`, an endpoint is set, and stub
  mode is off; otherwise it falls back.
- **Voice:** `onyx` (a calm, professional interviewer timbre). See
  `DEFAULT_TTS_VOICE` in `speech.ts`.
- **Cancellation:** `cancelSpeech()` immediately stops playing audio, aborts any
  in-flight `fetch` (via `AbortController`), and clears the Web Speech queue. A
  monotonic epoch guards against a slow response playing after the user moved on.
- **Caching:** synthesized audio is cached per `(voice, text)`, so repeated
  prompts never re-synthesize. `prefetch(text)` warms that cache for the next
  prompt (low latency, no autoplay).
- **Fallback:** on missing config / non-OK response / network error / offline /
  audio-playback failure, the controller falls back to Web Speech, which itself
  picks the best available local voice and tuned prosody.
- **Voice on/off:** `MockPage` passes `voiceOn` and only calls `speak()` when it
  is on, so nothing autoplays when voice is off. The controller adds no autoplay
  of its own.

## Server

New Lambda: `infra/lambda/ai-tts/index.mjs`.

- Sits behind the SAME API Gateway HTTP API + Cognito JWT authorizer as the
  ai-flavor Lambda, on a second route **`POST /tts`**.
- Reads the OpenAI API key from the SAME SSM SecureString parameter the
  ai-flavor Lambda reads (`AI_SSM_PARAM`, default
  `/quant-trader-prep/ai/api-key`) — the key is never in the client bundle or in
  CloudFormation.
- Calls OpenAI TTS (`${AI_BASE_URL}/audio/speech`, model `gpt-4o-mini-tts`,
  `response_format: "mp3"`) and returns base64 mp3 inside a JSON body, so **no
  API Gateway binary-media-type config is needed**.
- CORS headers match the other AI endpoints (`ALLOW_ORIGIN` from the stack's
  `CorsOrigins`, which includes the live Amplify prod domain).

### Request / response contract

Endpoint: `POST ${VITE_AI_ENDPOINT}/tts` (same base URL as `POST ${...}/ai`).

Request body (JSON):

```json
{ "text": "What is 12 times 12?", "voice": "onyx" }
```

- `text` (string, required) — the prompt to synthesize (server caps length).
- `voice` (string, optional) — one of the OpenAI TTS voices; unknown values fall
  back to the server default (`AI_TTS_VOICE`, default `onyx`).

Response body (JSON):

```json
{ "ok": true, "audioBase64": "<base64-encoded mp3>" }
```

On error the server returns a non-200 with `{ "ok": false, "error": "..." }`,
and the client falls back to Web Speech.

## Env vars

Client (Vite, reused from the AI flavor layer — no new client env var):

- `VITE_AI_LAYER=on`
- `VITE_AI_ENDPOINT=<AI API base URL>` (or `VITE_API_BASE_URL`)
- `VITE_AI_STUB` — when `on`, neural TTS is skipped (Web Speech only).

Server (set by `infra/cloudformation/quant-trader-prep-ai.yaml`):

- `AI_BASE_URL` — OpenAI-compatible base URL (default the OpenAI API).
- `AI_SSM_PARAM` — SSM SecureString name for the OpenAI key (shared with ai-flavor).
- `AI_TTS_MODEL` — TTS model id (default `gpt-4o-mini-tts`).
- `AI_TTS_VOICE` — default voice (default `onyx`).
- `ALLOW_ORIGIN` — CORS allow-origin (first of the stack's `CorsOrigins`).

## Deploy

```bash
./infra/deploy-ai.sh
```

This deploys the updated stack (adds the `${ProjectName}-ai-tts` function and the
`POST /tts` route) and uploads both the ai-flavor and ai-tts handler code. The
neural voice goes live automatically once the endpoint is reachable; until then
the client uses the Web Speech fallback.
