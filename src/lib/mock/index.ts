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
  gradeReasoningDeterministic,
  normalizeReasoningPayload,
  numbersIn,
  isHedgedReasoning,
  buildReasoningClarifyPrompt,
} from "./reasoning";
export type { ReasoningInput } from "./reasoning";
export {
  gradeConclusion,
  buildClarifyPrompt,
  committedPolarity,
  valuesIn,
} from "./conclusion";
export type {
  ConclusionVerdict,
  ConclusionSpec,
  ConclusionResult,
  Polarity,
} from "./conclusion";
export {
  buildFollowupPresentations,
  buildAiFollowup,
  gradeFollowup,
  gradeReasoningConclusion,
  gradeClarification,
  gradeMainClarification,
  specFromPresentation,
  gradeAgainstReference,
  extractTargetAnswer,
  keywordHit,
} from "./followups";
export {
  buildMarketMakingSteps,
  buildMockMmStep,
  initMmState,
  playMmRound,
  validateMmQuote,
  verdictFor,
  maxSpreadFor,
} from "./marketMaking";
export {
  drawNumericQuestion,
  drawNumericQuestionAvoiding,
  drawArchetype,
  archetypeFamily,
  toContentDifficulty,
  type PoolDifficulty,
  type MockNumericQuestion,
  type ArchetypeId,
} from "./questionPools";
export {
  difficultyRank,
  MIN_ITEM_DIFFICULTY_RANK,
  FOLLOWUP_TYPES,
  DECOMPOSITION_PHRASES,
  decompositionReason,
  belowFloorReason,
  missingTypeReason,
  auditFollowup,
  auditMathStepFollowups,
  auditScript,
  familyOfStep,
  familyCap,
  DEFAULT_FAMILY_CAP,
  FAMILY_CAP_BY_FAMILY,
  MIN_DISTINCT_FAMILIES,
} from "./interviewGate";
export type { FollowupBase, FollowupLike, GateReport } from "./interviewGate";
export {
  rubricItemsFromScript,
  reviewItem,
  reviewItemHeuristic,
  reviewItemWithLlm,
  reviewScript,
  buildRubricPrompt,
  parseRubricResponse,
  summarizeVerdicts,
  RUBRIC_SYSTEM_PREAMBLE,
} from "./interviewRubric";
export type {
  RubricItem,
  RubricFollowup,
  RubricFlag,
  RubricVerdict,
  RubricLlm,
  RubricSummary,
} from "./interviewRubric";
export {
  MOCK_PRESETS,
  PRESET_ORDER,
  getPreset,
  type MockPreset,
  type PresetItem,
  type PresetItemKind,
} from "./presets";
export {
  INTERVIEW_BLUEPRINT_2026,
  GOLD_ANCHORS,
  FOLLOWUP_TAXONOMY,
  blueprintForPreset,
  requiredArchetypes,
} from "./blueprint";
export type {
  FirmBlueprint,
  RoundBlueprint,
  RoundKind,
  TimingRegime,
  GoldAnchor,
  FollowupPatternSpec,
  FirmPriority,
  Confidence,
} from "./blueprint";
export {
  computePerformance,
  deterministicDiagnosis,
  floorDiagnosis,
  normalizeDiagnosisPayload,
  tierLabel,
} from "./diagnosis";
export {
  gradeReasoning,
  extractReasoningClaims,
  generateFollowup,
  getDiagnosis,
} from "./aiMock";
export {
  extractClaimsDeterministic,
  normalizeClaimsPayload,
  gradeReasoningFromClaims,
  gradeReasoningExtractVerify,
  firstFalseArithmeticClaim,
  claimsReachAnswer,
  claimEstablishesMechanism,
  claimEngagesQuantities,
} from "./claims";
export type { ReasoningClaim, ClaimSet, ClaimKind } from "./claims";
export {
  RUBRICS,
  rubricForId,
  rubricSignals,
} from "./rubrics";
export type { ArchetypeRubric, MechanismClass } from "./rubrics";
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
  mockActiveKey,
  MOCK_PERSIST_VERSION,
  serializeSession,
  deserializeSession,
  saveActiveSession,
  loadActiveSession,
  clearActiveSession,
} from "./persist";
export type { KeyValueStore } from "./persist";
