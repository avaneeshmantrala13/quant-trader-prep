/**
 * aiDevServer.test.ts — proves the SHARED AI router (`infra/lambda/ai-flavor/
 * core.mjs`) that BOTH the deployed Lambda and the local dev server use handles
 * EVERY mode and returns contract-shaped JSON — with a MOCKED provider, so no
 * real network and NO API key are needed (this is what CI runs).
 *
 * The core module is plain ESM (`.mjs`) shared with the AWS Lambda; we import it
 * at runtime by absolute file URL so this stays decoupled from the TS path setup.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

/* eslint-disable @typescript-eslint/no-explicit-any */
let core: any;

/** A mocked provider: returns the canned string, ignoring the prompt. */
function mockCaller(canned: string) {
  return async (_sys: string, _user: string, _wantJson?: boolean, _opts?: unknown) => canned;
}

beforeAll(async () => {
  const spec = pathToFileURL(
    resolve(process.cwd(), "infra/lambda/ai-flavor/core.mjs"),
  ).href;
  core = await import(/* @vite-ignore */ spec);
});

describe("shared AI core — provider config + guardrails (no key, no network)", () => {
  it("buildProviderConfig reads friendly aliases and defaults", () => {
    expect(core.buildProviderConfig({})).toEqual({
      provider: "openai",
      model: "gpt-4o-mini",
      baseUrl: "https://api.openai.com/v1",
    });
    expect(
      core.buildProviderConfig({ AI_PROVIDER: "anthropic", AI_PROVIDER_MODEL: "claude-x" }),
    ).toEqual({
      provider: "anthropic",
      model: "claude-x",
      baseUrl: "https://api.openai.com/v1",
    });
  });

  it("the flavor guardrail rejects an introduced number server-side", async () => {
    const res = await core.routeAiRequest({
      body: { mode: "flavor", prompt: "pick 3 of them", requiredNumbers: ["3"] },
      // The model invents a new number (7) — the server guardrail must reject.
      callLLM: mockCaller("in a pit, pick 3 of 7 traders"),
    });
    expect(res.status).toBe(200);
    expect(res.payload.ok).toBe(false);
    expect(res.payload.error).toMatch(/guardrail/);
  });
});

describe("shared AI core — every mode returns contract-shaped JSON", () => {
  it("flavor → { ok, prompt }", async () => {
    const res = await core.routeAiRequest({
      body: { mode: "flavor", prompt: "pick 3 of them", requiredNumbers: ["3"] },
      callLLM: mockCaller("On the desk, you pick 3 of them"),
    });
    expect(res.status).toBe(200);
    expect(res.payload.ok).toBe(true);
    expect(typeof res.payload.prompt).toBe("string");
  });

  it("open-ended → { ok, prompt, answer, explanation, verified:false }", async () => {
    const res = await core.routeAiRequest({
      body: { mode: "open-ended", topic: "bayes" },
      callLLM: mockCaller('{"prompt":"Q?","answer":"A","explanation":"E"}'),
    });
    expect(res.payload).toMatchObject({
      ok: true,
      prompt: "Q?",
      answer: "A",
      explanation: "E",
      verified: false,
    });
  });

  it("open-ended non-JSON → 502", async () => {
    const res = await core.routeAiRequest({
      body: { mode: "open-ended", topic: "bayes" },
      callLLM: mockCaller("not json"),
    });
    expect(res.status).toBe(502);
    expect(res.payload.ok).toBe(false);
  });

  it("hint → { ok, hint } and re-guards (no answer leak, no new numbers)", async () => {
    const res = await core.routeAiRequest({
      body: { mode: "hint", rung: "There are 3 doors", requiredNumbers: ["3"], answer: "2/3" },
      callLLM: mockCaller("Think about the 3 doors before switching"),
    });
    expect(res.payload.ok).toBe(true);
    expect(typeof res.payload.hint).toBe("string");
  });

  it("self-explain → { ok, correct, failedCheck, narration }", async () => {
    const res = await core.routeAiRequest({
      body: { mode: "self-explain", prompt: "Q", correct: true },
      callLLM: mockCaller("Great job spotting the symmetry."),
    });
    expect(res.payload).toMatchObject({ ok: true, correct: true });
    expect(typeof res.payload.narration).toBe("string");
  });

  it("parse-drill-intent → { ok, topicKeys[] }", async () => {
    const res = await core.routeAiRequest({
      body: { mode: "parse-drill-intent", text: "bayes please", vocabulary: [{ topicKey: "bayes" }] },
      callLLM: mockCaller('{"topicKeys":["bayes"],"minOrder":1,"maxOrder":3,"count":10}'),
    });
    expect(res.payload.ok).toBe(true);
    expect(res.payload.topicKeys).toEqual(["bayes"]);
  });

  it("mock-reason-grade → { ok, reasoningQuality, issues[], probe, clarifyPrompt }", async () => {
    const res = await core.routeAiRequest({
      body: { mode: "mock-reason-grade", prompt: "Q", correctAnswer: "2", correct: true },
      callLLM: mockCaller('{"reasoningQuality":"sound","issues":[],"probe":"p","clarifyPrompt":""}'),
    });
    expect(res.payload.ok).toBe(true);
    expect(res.payload.reasoningQuality).toBe("sound");
    expect(Array.isArray(res.payload.issues)).toBe(true);
  });

  it("mock-extract-claims → { ok, claims[] } with normalized kinds/values", async () => {
    const res = await core.routeAiRequest({
      body: { mode: "mock-extract-claims", prompt: "Q", correctAnswer: "2", reasoning: "1+1=2 so 2" },
      callLLM: mockCaller(
        '{"claims":[{"kind":"arithmetic","text":"1+1=2","expr":"1+1","value":2},' +
          '{"kind":"final-answer","text":"so 2","value":"2"},' +
          '{"kind":"junk","text":"drop me"}]}',
      ),
    });
    expect(res.payload.ok).toBe(true);
    // The junk-kind claim is dropped; the string value is coerced to a number.
    expect(res.payload.claims).toHaveLength(2);
    expect(res.payload.claims[0]).toMatchObject({ kind: "arithmetic", expr: "1+1", value: 2 });
    expect(res.payload.claims[1]).toMatchObject({ kind: "final-answer", value: 2 });
  });

  it("mock-review-reasoning → { ok, spans[], assessment } and maps bad→flawed", async () => {
    const res = await core.routeAiRequest({
      body: { mode: "mock-review-reasoning", prompt: "Q", correctAnswer: "2", reasoning: "abc" },
      callLLM: mockCaller('{"spans":[{"start":0,"end":3,"label":"bad","why":"nope"}],"assessment":"ok"}'),
    });
    expect(res.payload.ok).toBe(true);
    expect(res.payload.spans).toHaveLength(1);
    expect(res.payload.spans[0].label).toBe("flawed");
    expect(res.payload.assessment).toBe("ok");
  });

  it("mock-clarify-grade → { ok, resolved, issues[] }", async () => {
    const res = await core.routeAiRequest({
      body: { mode: "mock-clarify-grade", prompt: "Q", correctAnswer: "2" },
      callLLM: mockCaller('{"resolved":"yes","issues":[]}'),
    });
    expect(res.payload.ok).toBe(true);
    expect(res.payload.resolved).toBe("yes");
  });

  it("mock-followup → { ok, question, idealAnswerNote }", async () => {
    const res = await core.routeAiRequest({
      body: { mode: "mock-followup", prompt: "Q", correctAnswer: "2", difficulty: "harder" },
      callLLM: mockCaller('{"question":"What if n=10?","idealAnswerNote":"... = 0.25"}'),
    });
    expect(res.payload.ok).toBe(true);
    expect(res.payload.question).toBe("What if n=10?");
  });

  it("mock-diagnosis → { ok, verdict, wouldPass, strengths[], weaknesses[], nextSteps[] }", async () => {
    const res = await core.routeAiRequest({
      body: { mode: "mock-diagnosis", summary: { scorePct: 50 } },
      callLLM: mockCaller(
        '{"verdict":"v","wouldPass":"no","strengths":["s"],"weaknesses":["w"],"nextSteps":["n"]}',
      ),
    });
    expect(res.payload.ok).toBe(true);
    expect(res.payload.wouldPass).toBe("no");
    expect(res.payload.nextSteps).toEqual(["n"]);
  });

  it("routes ALL advertised modes (AI_MODES) to ok:true with a valid canned reply", async () => {
    const canned: Record<string, string> = {
      flavor: "pick 3 of them",
      "open-ended": '{"prompt":"Q","answer":"A","explanation":"E"}',
      hint: "consider the 3 doors",
      "self-explain": "nice",
      "parse-drill-intent": '{"topicKeys":[],"count":10}',
      "mock-reason-grade": '{"reasoningQuality":"partial"}',
      "mock-extract-claims": '{"claims":[]}',
      "mock-review-reasoning": '{"spans":[],"assessment":""}',
      "mock-clarify-grade": '{"resolved":"no"}',
      "mock-followup": '{"question":"Q","idealAnswerNote":"= 1"}',
      "mock-diagnosis": '{"verdict":"v","wouldPass":"borderline"}',
    };
    for (const mode of core.AI_MODES as string[]) {
      const body: Record<string, unknown> = { mode, prompt: "pick 3 of them", requiredNumbers: ["3"], rung: "the 3 doors", answer: "x" };
      const res = await core.routeAiRequest({ body, callLLM: mockCaller(canned[mode] ?? "{}") });
      expect(res.status, `${mode} status`).toBe(200);
      expect(res.payload.ok, `${mode} ok`).toBe(true);
    }
  });
});
