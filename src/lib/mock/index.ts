/**
 * Public surface of the mock-interview engine (TASK T10). All logic here is
 * pure and framework-free; the UI (`@/pages/MockPage`) is a thin renderer over
 * this API. See `./types` for the data model.
 */
export * from "./types";
export {
  buildInterview,
  createSession,
  mockReducer,
  currentStep,
  isCurrentAnswered,
  defaultInputMode,
  toPersistableResponse,
  toPersistableSummary,
} from "./engine";
export type {
  MockSession,
  MockAction,
  SessionStatus,
  InputMode,
} from "./engine";
export {
  scoreMathAnswer,
  classifyTiming,
  normalizeSpokenNumber,
} from "./scoring";
export { selectBehavioral, BEHAVIORAL_BANK_SIZE } from "./behavioral";
export {
  createSpeechController,
  detectSpeechSupport,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  pickBestVoice,
  scoreVoice,
  chunkForSpeech,
} from "./speech";
export type {
  SpeechController,
  SpeechSupport,
  ListenHandlers,
  SpeechControllerOptions,
  VoiceLike,
} from "./speech";
export {
  MOCK_ACTIVE_KEY,
  MOCK_PERSIST_VERSION,
  serializeSession,
  deserializeSession,
  saveActiveSession,
  loadActiveSession,
  clearActiveSession,
} from "./persist";
export type { KeyValueStore } from "./persist";
