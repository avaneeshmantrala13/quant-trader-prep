import type { ItemAttempt, TopicMastery } from "@/types/mastery";
import { useProgress } from "@/context/ProgressContext";
import type { TopicVerdict } from "./verdict";

/**
 * Thin convenience wrapper over `useProgress()` (COORDINATION §2.3). This
 * introduces NO second source of truth — it just narrows the progress context
 * to the mastery surface downstream phases care about. Prefer this in
 * mastery-facing components so they don't reach into unrelated progress APIs.
 */
export interface MasteryApi {
  recordItemAttempt: (a: ItemAttempt) => void;
  getTopicMastery: (topicKey: string) => TopicMastery | undefined;
  getTopicVerdict: (topicKey: string) => TopicVerdict;
}

export function useMastery(): MasteryApi {
  const { recordItemAttempt, getTopicMastery, getTopicVerdict } = useProgress();
  return { recordItemAttempt, getTopicMastery, getTopicVerdict };
}
