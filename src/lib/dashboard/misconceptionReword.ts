/**
 * OPTIONAL LLM reword for dashboard misconception labels (Task 1b).
 *
 * This is a pure-polish layer on top of the DETERMINISTIC labels produced by
 * `describeMisconception` (`./misconceptionLabels`). It can ask the guarded AI
 * endpoint (the same Lambda `aiFlavor.ts` talks to) to rephrase those labels
 * into neater prose — but it obeys the same hard rules as the rest of the AI
 * layer:
 *
 *   • OFF BY DEFAULT — gated behind `VITE_AI_LAYER=on` (via `readAiConfig`).
 *     With the flag off (the default), and in the local `VITE_AI_STUB=on`
 *     sub-mode, it is a graceful no-op that returns the deterministic labels
 *     unchanged.
 *   • DEGRADES SAFELY — on flag-off / stub / network error / timeout / malformed
 *     response it returns the deterministic label for every item. The dashboard
 *     is always fully functional and correct with the flag OFF.
 *   • DISPLAY-ONLY — it NEVER changes WHICH topics or misconceptions are shown.
 *     The data (selection + ordering) is computed deterministically upstream;
 *     this only swaps the human-readable DISPLAY STRING for each item, aligning
 *     one-to-one by index, and only when a non-empty rewrite comes back.
 *
 * The assembly (`buildRewordPayload`) and the per-item fallback (`pickReworded`)
 * are pure and unit-tested; the async orchestrator accepts injected `env` /
 * `transport` so its flag-off, stub, success, and failure paths are all testable
 * without touching `import.meta.env` or the network.
 */
import { env, postAi } from "@/lib/aiFlavor";
import { readAiConfig, type AiConfig, type EnvLike } from "@/lib/aiConfig";

/** One label to (optionally) reword, paired with the context the model may use. */
export interface RewordItem {
  /**
   * The DETERMINISTIC, already-human-readable label (from
   * `describeMisconception`). This is the guaranteed fallback and is NEVER a raw
   * key.
   */
  deterministic: string;
  /** Nice topic name for context (helps the model phrase naturally). */
  topicName: string;
  /**
   * Optional canonical semantic tag for context only. Never shown to the user;
   * purely a hint to the model. Absent for `idx:`/`err:` fallback items.
   */
  tag?: string;
}

/** The request body POSTed to the guarded AI endpoint. Pure, deterministic. */
export interface RewordPayload {
  mode: "dashboard-misconception-reword";
  items: { label: string; topic: string; tag: string | null }[];
}

/** The transport signature (defaults to the guarded `postAi` from aiFlavor). */
export type RewordTransport = (
  cfg: AiConfig,
  e: EnvLike,
  body: unknown,
  signal?: AbortSignal,
) => Promise<Record<string, unknown> | null>;

export interface RewordOptions {
  /** Env bag override (defaults to Vite's `import.meta.env`). */
  env?: EnvLike;
  /** Abort the request (and fall back) after this many ms. Default 4000. */
  timeoutMs?: number;
  /** External abort signal (composed with the timeout). */
  signal?: AbortSignal;
  /** Injectable transport (defaults to the guarded `postAi`). For testing. */
  transport?: RewordTransport;
}

/**
 * Assemble the request body. Pure: same input → same output, no I/O. The model
 * is asked ONLY to rephrase each `label` (the topic/tag are context) — the
 * caller enforces that the response never changes the item set or order.
 */
export function buildRewordPayload(items: RewordItem[]): RewordPayload {
  return {
    mode: "dashboard-misconception-reword",
    items: items.map((it) => ({
      label: it.deterministic,
      topic: it.topicName,
      tag: it.tag ?? null,
    })),
  };
}

/**
 * Choose the display string for ONE item: the model's candidate when it is a
 * non-empty string, else the deterministic label. Pure — the safe-fallback core.
 */
export function pickReworded(deterministic: string, candidate: unknown): string {
  return typeof candidate === "string" && candidate.trim().length > 0
    ? candidate.trim()
    : deterministic;
}

/**
 * Extract the parallel `labels` array from a raw endpoint response, aligning it
 * one-to-one (by index) with `items` and falling back per-item. If the response
 * is missing / malformed, EVERY item falls back to its deterministic label.
 * Pure.
 */
export function resolveRewordResponse(
  items: RewordItem[],
  payload: Record<string, unknown> | null,
): string[] {
  const labels = payload && Array.isArray(payload["labels"]) ? payload["labels"] : [];
  return items.map((it, i) => pickReworded(it.deterministic, labels[i]));
}

/**
 * Reword the given labels via the guarded AI layer, returning a string per item
 * (SAME length + order as `items`). Returns the deterministic labels unchanged
 * when the layer is off (default) or on any stub / error / timeout / malformed
 * response — so the caller can use the result unconditionally.
 */
export async function rewordMisconceptionLabels(
  items: RewordItem[],
  opts: RewordOptions = {},
): Promise<string[]> {
  const fallback = items.map((it) => it.deterministic);
  if (items.length === 0) return fallback;

  const e = opts.env ?? env();
  const cfg = readAiConfig(e);
  // Flag OFF / unconfigured (the default), or local stub → deterministic no-op.
  if (!cfg || cfg.stub) return fallback;

  const transport = opts.transport ?? postAi;
  const timeoutMs = opts.timeoutMs ?? 4000;

  // Compose an internal timeout with any caller-supplied signal, when the
  // runtime supports it. If it doesn't, we simply skip the timeout wiring.
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let signal = opts.signal;
  if (typeof AbortController !== "undefined") {
    controller = new AbortController();
    signal = controller.signal;
    if (opts.signal) {
      if (opts.signal.aborted) controller.abort();
      else opts.signal.addEventListener("abort", () => controller?.abort());
    }
    timer = setTimeout(() => controller?.abort(), timeoutMs);
  }

  try {
    const payload = await transport(cfg, e, buildRewordPayload(items), signal);
    return resolveRewordResponse(items, payload);
  } catch {
    // Network failure, abort/timeout, or any other error → deterministic labels.
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
