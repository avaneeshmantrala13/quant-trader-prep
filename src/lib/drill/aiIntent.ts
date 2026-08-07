import { readAiConfig } from "@/lib/aiConfig";
import { env, postAi } from "@/lib/aiFlavor";
import { DIFFICULTY_META } from "@/types/content";
import { DRILL_TOPIC_KEYS, DRILL_TOPICS } from "./vocabulary";
import {
  DRILL_COUNT_MAX,
  DRILL_COUNT_MIN,
  clampCount,
  parseDrillIntent,
  type DrillSpec,
} from "./parseIntent";

/**
 * Custom Drill Builder — OPTIONAL LLM intent parser (behind the AI flag).
 *
 * "LLM proposes, code verifies": the model reads the free text and the known
 * vocabulary and proposes `{ topicKeys, minOrder, maxOrder, count }`. We then
 * SNAP that proposal back onto the deterministic vocabulary — unknown topicKeys
 * are dropped, difficulty orders are clamped to [0,4], count is clamped to the
 * allowed band. The model is never trusted to invent a section or an item.
 *
 * Returns `null` when the AI layer is off / unconfigured / errors, so the caller
 * falls back to the pure {@link parseDrillIntent}. When the stub is on we skip
 * the network and just return the deterministic parse (so the UI wiring is
 * exercisable with zero infra).
 */
export async function requestDrillIntent(
  text: string,
  signal?: AbortSignal,
): Promise<DrillSpec | null> {
  const e = env();
  const cfg = readAiConfig(e);
  if (!cfg) return null; // flag off / unconfigured → caller uses deterministic parse

  // Stub mode: no network. The deterministic parse IS the safe answer.
  if (cfg.stub) return parseDrillIntent(text);

  // Give the model the exact vocabulary it may choose from (topicKey + label +
  // a few aliases) so it maps onto real sections rather than inventing labels.
  const vocabulary = DRILL_TOPICS.map((t) => ({
    topicKey: t.topicKey,
    label: t.label,
    aliases: t.aliases.slice(0, 6),
  }));

  const payload = await postAi(
    cfg,
    e,
    {
      mode: "parse-drill-intent",
      text,
      vocabulary,
      difficultyOrders: Object.fromEntries(
        Object.entries(DIFFICULTY_META).map(([k, v]) => [k, v.order]),
      ),
      countBand: { min: DRILL_COUNT_MIN, max: DRILL_COUNT_MAX },
    },
    signal,
  );

  const snapped = snapToVocabulary(payload);
  // If the model produced nothing usable, let the caller fall back.
  return snapped;
}

const MAX_ORDER = DIFFICULTY_META.expert.order;

function clampOrder(x: unknown, fallback: number): number {
  const n = typeof x === "number" ? x : Number(x);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(MAX_ORDER, Math.round(n)));
}

/**
 * Validate + clamp a raw LLM proposal into a safe {@link DrillSpec}. Any field
 * the model got wrong degrades to a safe default; unknown topicKeys are dropped.
 * Returns `null` only when the payload is entirely unusable (so the caller can
 * fall back to the deterministic parser).
 */
export function snapToVocabulary(
  payload: Record<string, unknown> | null,
): DrillSpec | null {
  if (!payload || typeof payload !== "object") return null;

  const rawKeys = Array.isArray(payload["topicKeys"])
    ? (payload["topicKeys"] as unknown[])
    : [];
  const seen = new Set<string>();
  const topicKeys: string[] = [];
  for (const k of rawKeys) {
    if (typeof k === "string" && DRILL_TOPIC_KEYS.has(k) && !seen.has(k)) {
      seen.add(k);
      topicKeys.push(k);
    }
  }
  // No recognized topic ⇒ unusable; fall back to deterministic parsing.
  if (topicKeys.length === 0) return null;

  let minOrder = clampOrder(payload["minOrder"], 0);
  let maxOrder = clampOrder(payload["maxOrder"], MAX_ORDER);
  if (minOrder > maxOrder) [minOrder, maxOrder] = [maxOrder, minOrder];

  const rawCount =
    typeof payload["count"] === "number"
      ? (payload["count"] as number)
      : Number(payload["count"]);
  // `clampCount` already degrades a non-finite value to the default, so an
  // absent/garbage `count` from the model yields the sane default rather than 0.
  const count = clampCount(rawCount);

  return { topicKeys, minOrder, maxOrder, count };
}
