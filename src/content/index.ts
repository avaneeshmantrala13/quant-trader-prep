import type { Track } from "@/types/content";
import { probabilityTrack } from "./probability/levels";
import { mentalMathTrack } from "./mentalMath/levels";
import { brainteasersTrack } from "./brainteasers/levels";
import { interviewGamesTrack } from "./interviewGames/levels";

/** Teaser-only flagship. Rendered as "Coming soon" per the PRD scope. */
export const calibrationGymTrack: Track = {
  id: "calibration-gym",
  title: "Calibration Gym",
  tagline: "Price uncertainty. Beat the model.",
  description:
    "The flagship: submit a probability or interval under a timer, then a grand reveal scores you against a calibrated model on the same fresh problem — confetti on a win, a teaching moment on a loss. Coming soon.",
  motif: "calibration",
  levels: [],
  comingSoon: true,
};

/** The four playable tabs, in recommended order, plus the teaser. */
export const TRACKS: Track[] = [
  probabilityTrack,
  mentalMathTrack,
  brainteasersTrack,
  interviewGamesTrack,
  calibrationGymTrack,
];

export const PLAYABLE_TRACKS = TRACKS.filter((t) => !t.comingSoon);

export function getTrack(id: string): Track | undefined {
  return TRACKS.find((t) => t.id === id);
}

export function getLevel(trackId: string, levelId: string) {
  const track = getTrack(trackId);
  const level = track?.levels.find((l) => l.id === levelId);
  return level ? { track, level } : undefined;
}

/** A level is unlocked iff it is the first, or the previous level is mastered. */
export function isLevelUnlocked(
  trackId: string,
  levelIndex: number,
  isMastered: (levelId: string) => boolean,
): boolean {
  if (levelIndex <= 0) return true;
  const track = getTrack(trackId);
  if (!track) return false;
  const prev = track.levels[levelIndex - 1];
  return prev ? isMastered(prev.id) : false;
}
