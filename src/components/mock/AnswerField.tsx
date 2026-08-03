import { useState } from "react";
import type { UseMockSpeech } from "./useMockSpeech";

/**
 * Reusable answer entry for the mock interview. Always renders a typed input
 * (the reliable baseline); when SpeechRecognition is available it ALSO offers a
 * "dictate" mic that fills the same field. This is the concrete graceful
 * degradation: with no mic the learner simply types, and the flow is unchanged.
 */

function MicGlyph({ active }: { active: boolean }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={active ? "animate-pulse" : undefined}
    >
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

export function AnswerField({
  value,
  onChange,
  onSubmit,
  speech,
  placeholder,
  submitLabel = "Submit ▸",
  multiline = false,
  inputMode = "text",
  ariaLabel,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  speech: UseMockSpeech;
  placeholder?: string;
  submitLabel?: string;
  multiline?: boolean;
  inputMode?: "text" | "decimal";
  ariaLabel: string;
  disabled?: boolean;
}) {
  const [dictateError, setDictateError] = useState<string | null>(null);

  const toggleDictate = () => {
    if (speech.listening) {
      speech.stopListening();
      return;
    }
    setDictateError(null);
    speech.startListening((finalText) => {
      // Append dictated text to whatever is already typed.
      onChange(value ? `${value} ${finalText}`.trim() : finalText.trim());
    });
  };

  // Show live interim transcript merged into the field for immediate feedback.
  const shown = speech.listening && speech.interim
    ? (value ? `${value} ${speech.interim}`.trim() : speech.interim)
    : value;

  return (
    <div>
      <div className="flex items-stretch gap-2">
        <div className="flex flex-1 items-center border-2 border-border-strong bg-surface focus-within:border-accent">
          {multiline ? (
            <textarea
              value={shown}
              disabled={disabled}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              aria-label={ariaLabel}
              rows={3}
              className="min-h-[72px] w-full resize-y bg-transparent p-3 text-[15px] text-primary outline-none disabled:opacity-70"
            />
          ) : (
            <input
              type="text"
              inputMode={inputMode}
              autoComplete="off"
              value={shown}
              disabled={disabled}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !disabled) onSubmit();
              }}
              placeholder={placeholder}
              aria-label={ariaLabel}
              className="num min-h-[44px] w-full bg-transparent px-3 py-2 text-lg font-semibold text-primary outline-none disabled:opacity-70"
            />
          )}
          {speech.canListen && (
            <button
              type="button"
              onClick={toggleDictate}
              disabled={disabled}
              aria-pressed={speech.listening}
              aria-label={speech.listening ? "Stop dictation" : "Dictate answer"}
              title={speech.listening ? "Stop dictation" : "Dictate answer"}
              className={`grid h-11 w-11 shrink-0 place-items-center border-l-2 border-border-strong transition-colors ${
                speech.listening
                  ? "bg-accent text-accent-contrast"
                  : "text-secondary hover:text-accent"
              }`}
            >
              <MicGlyph active={speech.listening} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          className="btn-primary px-5"
        >
          {submitLabel}
        </button>
      </div>
      {speech.listening && (
        <p className="mt-2 flex items-center gap-2 text-xs text-accent" role="status">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
          Listening… speak your answer, then tap the mic to finish.
        </p>
      )}
      {dictateError && (
        <p className="mt-2 text-sm text-bear" role="alert">
          {dictateError}
        </p>
      )}
    </div>
  );
}
