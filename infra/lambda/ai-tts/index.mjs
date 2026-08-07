/**
 * quant-trader-prep — AI text-to-speech (neural voice) Lambda.
 *
 * Gives the AI Mock Interview a human-sounding interviewer voice. It sits behind
 * the SAME API Gateway HTTP API as the ai-flavor Lambda (see
 * `infra/cloudformation/quant-trader-prep-ai.yaml`), on its own `POST /tts`
 * route with the SAME Cognito JWT authorizer, and reads the SAME OpenAI API key
 * from SSM Parameter Store (SecureString) that ai-flavor reads — the key NEVER
 * lives in the browser bundle or in CloudFormation.
 *
 * Contract:
 *   Request  (JSON): { text: string, voice?: string }
 *   Response (JSON): { ok: true, audioBase64: string }   // base64-encoded mp3
 *
 * Returning base64 mp3 inside a JSON body means NO API Gateway binary-media-type
 * configuration is needed: the client decodes base64 → Blob → object URL and
 * plays it via an HTMLAudioElement. On any failure the client falls back to the
 * browser's Web Speech synthesis, so this endpoint is a pure enhancement.
 *
 * Runtime: nodejs20.x — `fetch` is global and the AWS SDK v3 is bundled in the
 * runtime, so this file needs NO npm install / packaging (mirrors ai-flavor).
 *
 * Env vars (set by the CloudFormation template):
 *   AI_BASE_URL   OpenAI-compatible base URL (default the OpenAI API). The TTS
 *                 request goes to `${AI_BASE_URL}/audio/speech`.
 *   AI_SSM_PARAM  SSM SecureString name holding the OpenAI API key (the SAME
 *                 parameter ai-flavor reads).
 *   AI_TTS_MODEL  TTS model id (default "gpt-4o-mini-tts").
 *   AI_TTS_VOICE  Default voice when the request omits one (default "onyx").
 *   ALLOW_ORIGIN  CORS allow-origin (default "*").
 */
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const REGION = process.env.AWS_REGION || "us-east-1";
const BASE_URL = process.env.AI_BASE_URL || "https://api.openai.com/v1";
const SSM_PARAM = process.env.AI_SSM_PARAM || "/quant-trader-prep/ai/api-key";
const TTS_MODEL = process.env.AI_TTS_MODEL || "gpt-4o-mini-tts";
const DEFAULT_VOICE = process.env.AI_TTS_VOICE || "onyx";
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || "*";

// The set of voices OpenAI's TTS models accept; unknown values fall back to the
// configured default so a bad client request can never 4xx the whole endpoint.
const ALLOWED_VOICES = new Set([
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "onyx",
  "nova",
  "sage",
  "shimmer",
]);

// A short instruction that nudges the model toward a calm, professional
// interviewer delivery with a natural, measured pace.
const VOICE_INSTRUCTIONS =
  "Speak like a calm, warm, professional quant-trading interviewer. Use a " +
  "natural, measured pace with clear articulation. Sound human and composed, " +
  "never robotic or rushed.";

const ssm = new SSMClient({ region: REGION });

// Cache the API key across warm invocations (never logged).
let cachedKey = null;
async function getApiKey() {
  if (cachedKey) return cachedKey;
  const out = await ssm.send(
    new GetParameterCommand({ Name: SSM_PARAM, WithDecryption: true }),
  );
  cachedKey = out.Parameter?.Value || null;
  return cachedKey;
}

const CORS = {
  "content-type": "application/json",
  "access-control-allow-origin": ALLOW_ORIGIN,
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const reply = (statusCode, obj) => ({
  statusCode,
  headers: CORS,
  body: JSON.stringify(obj),
});

// Join an OpenAI-compatible base URL with the audio-speech path, robustly:
// trims trailing slashes, and if the base already ends in `/audio/speech` uses
// it as-is. So `https://api.openai.com/v1` → `.../v1/audio/speech`.
function audioSpeechUrl(base) {
  const b = String(base || "").trim().replace(/\/+$/, "");
  return /\/audio\/speech$/.test(b) ? b : `${b}/audio/speech`;
}

export const handler = async (event) => {
  const method =
    event?.requestContext?.http?.method || event?.httpMethod || "POST";
  if (method === "OPTIONS") return reply(200, { ok: true });

  let body = {};
  try {
    body = JSON.parse(event?.body || "{}");
  } catch {
    return reply(400, { ok: false, error: "bad json" });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return reply(400, { ok: false, error: "missing text" });
  // Cap input length as a cheap spend/abuse guard (prompts are short).
  const input = text.slice(0, 4000);
  const voice = ALLOWED_VOICES.has(body.voice) ? body.voice : DEFAULT_VOICE;

  let key;
  try {
    key = await getApiKey();
  } catch (e) {
    console.warn("SSM getParameter failed:", e?.message);
    return reply(500, { ok: false, error: "AI key not configured" });
  }
  if (!key) return reply(500, { ok: false, error: "AI key not configured" });

  try {
    const res = await fetch(audioSpeechUrl(BASE_URL), {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: TTS_MODEL,
        voice,
        input,
        response_format: "mp3",
        instructions: VOICE_INSTRUCTIONS,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn(`TTS provider ${res.status}: ${detail?.slice(0, 200)}`);
      return reply(502, { ok: false, error: "TTS provider error" });
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return reply(200, { ok: true, audioBase64: buf.toString("base64") });
  } catch (e) {
    console.warn("TTS call failed:", e?.message);
    return reply(502, { ok: false, error: "TTS call failed" });
  }
};
