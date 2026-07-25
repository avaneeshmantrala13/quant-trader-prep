import { describe, expect, it, vi } from "vitest";
import type { EnvLike } from "@/lib/aiConfig";
import {
  buildRewordPayload,
  pickReworded,
  resolveRewordResponse,
  rewordMisconceptionLabels,
  type RewordItem,
} from "./misconceptionReword";

const ITEMS: RewordItem[] = [
  {
    deterministic: "Confusing P(A|B) with P(B|A)",
    topicName: "Conditional Probability & Bayes",
    tag: "reversed_conditional",
  },
  {
    deterministic: "Recurring mistakes in Expected Value",
    topicName: "Expected Value",
  },
];

const FALLBACK = ITEMS.map((i) => i.deterministic);

const ENV_OFF: EnvLike = {};
const ENV_STUB: EnvLike = { VITE_AI_LAYER: "on", VITE_AI_STUB: "on" };
const ENV_ON: EnvLike = {
  VITE_AI_LAYER: "on",
  VITE_AI_ENDPOINT: "https://ai.example.test",
};

describe("buildRewordPayload (pure assembly)", () => {
  it("maps each item to {label, topic, tag} with a null tag when absent", () => {
    expect(buildRewordPayload(ITEMS)).toEqual({
      mode: "dashboard-misconception-reword",
      items: [
        {
          label: "Confusing P(A|B) with P(B|A)",
          topic: "Conditional Probability & Bayes",
          tag: "reversed_conditional",
        },
        {
          label: "Recurring mistakes in Expected Value",
          topic: "Expected Value",
          tag: null,
        },
      ],
    });
  });

  it("is deterministic (same input → identical output)", () => {
    expect(buildRewordPayload(ITEMS)).toEqual(buildRewordPayload(ITEMS));
  });
});

describe("pickReworded (pure per-item fallback)", () => {
  it("uses a non-empty trimmed candidate string", () => {
    expect(pickReworded("det", "  polished  ")).toBe("polished");
  });

  it("falls back to deterministic for empty / non-string candidates", () => {
    expect(pickReworded("det", "")).toBe("det");
    expect(pickReworded("det", "   ")).toBe("det");
    expect(pickReworded("det", undefined)).toBe("det");
    expect(pickReworded("det", null)).toBe("det");
    expect(pickReworded("det", 42)).toBe("det");
  });
});

describe("resolveRewordResponse (index-aligned, safe fallback)", () => {
  it("aligns labels by index and falls back per missing/blank entry", () => {
    expect(
      resolveRewordResponse(ITEMS, { labels: ["Nice rephrase", ""] }),
    ).toEqual(["Nice rephrase", FALLBACK[1]]);
  });

  it("falls back entirely for a malformed / missing response", () => {
    expect(resolveRewordResponse(ITEMS, null)).toEqual(FALLBACK);
    expect(resolveRewordResponse(ITEMS, {})).toEqual(FALLBACK);
    expect(resolveRewordResponse(ITEMS, { labels: "nope" })).toEqual(FALLBACK);
  });
});

describe("rewordMisconceptionLabels (orchestrator)", () => {
  it("returns deterministic labels with the flag OFF (default) — no transport call", async () => {
    const transport = vi.fn();
    const out = await rewordMisconceptionLabels(ITEMS, {
      env: ENV_OFF,
      transport,
    });
    expect(out).toEqual(FALLBACK);
    expect(transport).not.toHaveBeenCalled();
  });

  it("returns deterministic labels in stub mode — no transport call", async () => {
    const transport = vi.fn();
    const out = await rewordMisconceptionLabels(ITEMS, {
      env: ENV_STUB,
      transport,
    });
    expect(out).toEqual(FALLBACK);
    expect(transport).not.toHaveBeenCalled();
  });

  it("applies a valid reword when the layer is ON", async () => {
    const transport = vi
      .fn()
      .mockResolvedValue({ labels: ["Polished A", "Polished B"] });
    const out = await rewordMisconceptionLabels(ITEMS, {
      env: ENV_ON,
      transport,
    });
    expect(out).toEqual(["Polished A", "Polished B"]);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("keeps the SAME count/order and falls back per blank on partial rewrites", async () => {
    const transport = vi.fn().mockResolvedValue({ labels: ["Only first"] });
    const out = await rewordMisconceptionLabels(ITEMS, {
      env: ENV_ON,
      transport,
    });
    expect(out).toEqual(["Only first", FALLBACK[1]]);
  });

  it("degrades to deterministic labels on a transport error/timeout", async () => {
    const transport = vi.fn().mockRejectedValue(new Error("network/abort"));
    const out = await rewordMisconceptionLabels(ITEMS, {
      env: ENV_ON,
      transport,
    });
    expect(out).toEqual(FALLBACK);
  });

  it("degrades to deterministic labels on a null / malformed response", async () => {
    const transport = vi.fn().mockResolvedValue(null);
    const out = await rewordMisconceptionLabels(ITEMS, {
      env: ENV_ON,
      transport,
    });
    expect(out).toEqual(FALLBACK);
  });

  it("no-ops on an empty item list", async () => {
    const transport = vi.fn();
    expect(
      await rewordMisconceptionLabels([], { env: ENV_ON, transport }),
    ).toEqual([]);
    expect(transport).not.toHaveBeenCalled();
  });
});
