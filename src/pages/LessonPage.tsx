import { Navigate, useParams } from "react-router-dom";
import { getTrack } from "@/content";
import { isFlashcardLevel, isNumericLevel } from "@/types/content";
import { FlashcardLevel } from "@/pages/lesson/FlashcardLevel";
import { QuizLevel } from "@/pages/lesson/QuizLevel";
import { NumericLevel } from "@/pages/lesson/NumericLevel";
import { FinishRemediation } from "@/pages/lesson/remediation";

// Re-exported for `finishRemediation.test.ts` (historical import path).
export { FinishRemediation };

/**
 * Route entry for playing a level. It dispatches on the level's `mode`:
 * `"flashcard"` levels (brainteasers) use the integrity-based reveal deck;
 * numeric levels use the free-entry player; everything else uses the scored
 * multiple-choice quiz. Each player lives in its own `@/pages/lesson/*` module.
 */
export function LessonPage() {
  const { trackId, levelId } = useParams();
  const track = trackId ? getTrack(trackId) : undefined;
  const level = track?.levels.find((l) => l.id === levelId);
  if (!track || !level) return <Navigate to="/" replace />;
  if (isFlashcardLevel(level))
    return <FlashcardLevel track={track} level={level} />;
  if (isNumericLevel(level))
    return <NumericLevel track={track} level={level} />;
  return <QuizLevel track={track} level={level} />;
}
