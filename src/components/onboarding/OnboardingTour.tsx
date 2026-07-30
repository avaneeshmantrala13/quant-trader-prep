import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useTheme } from "@/context/ThemeContext";
import type { OnboardingStep } from "@/lib/onboarding/steps";
import {
  computeCoachmarkPlacement,
  tourTargetSelector,
  type Placement,
  type Rect,
} from "@/lib/onboarding/anchor";

interface OnboardingTourProps {
  /** Whether the tour overlay is currently shown. */
  open: boolean;
  /** Ordered step script (see `@/lib/onboarding/steps`). */
  steps: OnboardingStep[];
  /**
   * Called when the tour ends — either by finishing the last step, pressing
   * "Skip", closing with Esc, or clicking the backdrop. The parent persists the
   * "shown once" flag and hides the overlay.
   */
  onClose: () => void;
  /**
   * Called whenever the CURRENT step's anchor target changes (and with
   * `undefined` when the tour closes). The shell uses this to reveal the
   * hamburger navigation menu so a coach-mark can anchor to a menu item that
   * would otherwise be collapsed. Optional — the tour works without it.
   */
  onActiveTargetChange?: (target: OnboardingStep["target"] | undefined) => void;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * The new-user ONBOARDING TOUR overlay: a sequence of themed, ANCHORED
 * coach-marks. Each step (except the centered welcome/wrap-up) points a small
 * arrow at the nav item it describes and spotlights that element, and the tour
 * walks through the steps IN PLACE via Next/Back — it never navigates the user
 * away. Presentation-only + accessible (focus trap, Esc/Skip, keyboard
 * Next/Back, reduced-motion friendly). ALL styling flows through the app's
 * semantic theme tokens, so it looks native to each of the 6 themes in light
 * AND dark. Positions recompute on resize/scroll and fall back to a centered
 * box when a target isn't rendered. Trigger + persistence live in the pure
 * `@/lib/onboarding` modules and `AppShell`.
 */
export function OnboardingTour({
  open,
  steps,
  onClose,
  onActiveTargetChange,
}: OnboardingTourProps) {
  const { themeDef } = useTheme();
  const [index, setIndex] = useState(0);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const nextBtnRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const bodyId = useId();

  const step = steps[Math.min(index, Math.max(0, steps.length - 1))];
  const targetToken = step?.target;

  // Reset to the first step every time the tour (re)opens, and remember which
  // element had focus so we can restore it on close (accessibility).
  useEffect(() => {
    if (open) {
      setIndex(0);
      restoreFocusRef.current =
        (document.activeElement as HTMLElement | null) ?? null;
    }
  }, [open]);

  // Tell the shell which target the current step anchors to, so it can reveal
  // the (collapsed) hamburger menu when a step points at a menu item. Reports
  // `undefined` while the tour is closed so the menu never sticks open.
  useEffect(() => {
    onActiveTargetChange?.(open ? targetToken : undefined);
  }, [open, targetToken, onActiveTargetChange]);

  // Measure the target + box and decide where to place the coach-mark. Reads
  // live rects so it stays correct across steps, resizes, and scrolls. Falls
  // back to a centered box when the target isn't rendered/visible.
  const recompute = useCallback(() => {
    const box = dialogRef.current;
    if (!box) return;
    const boxRect = box.getBoundingClientRect();
    const boxSize = { width: boxRect.width, height: boxRect.height };
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    let rect: Rect | null = null;
    if (targetToken) {
      const el = document.querySelector<HTMLElement>(
        tourTargetSelector(targetToken),
      );
      if (el) {
        const r = el.getBoundingClientRect();
        // Treat zero-size / detached elements as "not visible" → center.
        if (r.width > 0 && r.height > 0) {
          rect = { top: r.top, left: r.left, width: r.width, height: r.height };
        }
      }
    }

    setTargetRect(rect);
    setPlacement(computeCoachmarkPlacement(rect, viewport, boxSize));
  }, [targetToken]);

  // Position synchronously before paint so the box never flashes at the wrong
  // spot when the tour opens or the step changes.
  useLayoutEffect(() => {
    if (!open) return;
    recompute();
  }, [open, index, recompute]);

  // Scroll the target into view (if any), then keep the box glued to it while
  // anything moves. Scroll is captured so it also catches the nav's own
  // horizontal scroll container.
  useEffect(() => {
    if (!open) return;

    if (targetToken) {
      const el = document.querySelector<HTMLElement>(
        tourTargetSelector(targetToken),
      );
      el?.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    }

    const raf = window.requestAnimationFrame(recompute);
    // A second, slightly delayed measure catches targets that mount just AFTER
    // this step change — e.g. a menu item that appears once the shell opens the
    // hamburger menu in response to this step's target.
    const settle = window.setTimeout(recompute, 90);
    window.addEventListener("resize", recompute);
    window.addEventListener("scroll", recompute, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(settle);
      window.removeEventListener("resize", recompute);
      window.removeEventListener("scroll", recompute, true);
    };
  }, [open, index, targetToken, recompute]);

  // Move focus into the dialog on open and whenever the step changes so a
  // keyboard/screen-reader user always lands on the primary action.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => nextBtnRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open, index]);

  // Restore focus to the trigger when the tour closes.
  useEffect(() => {
    if (open) return;
    restoreFocusRef.current?.focus?.();
  }, [open]);

  const close = useCallback(() => {
    onClose();
  }, [onClose]);

  const goNext = useCallback(() => {
    setIndex((i) => {
      if (i >= steps.length - 1) {
        close();
        return i;
      }
      return i + 1;
    });
  }, [steps.length, close]);

  const goBack = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  // Keyboard: Esc skips, Tab is trapped inside the dialog, and Enter on the
  // primary button advances (native). Arrow keys move between steps.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goBack();
        return;
      }
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [close, goNext, goBack],
  );

  if (!open || steps.length === 0 || !step) return null;

  const isLast = index >= steps.length - 1;
  const isFirst = index === 0;
  const side = placement?.side ?? "center";
  const anchored = side !== "center" && targetRect !== null;

  return (
    <div className="fixed inset-0 z-50" aria-hidden={false}>
      {/* Dismiss layer — click to skip. Transparent when we spotlight a target
          (the spotlight below supplies the dimming); a plain scrim otherwise. */}
      <button
        type="button"
        aria-label="Dismiss tutorial"
        onClick={close}
        className={`absolute inset-0 h-full w-full cursor-default ${
          anchored ? "bg-transparent" : "bg-black/55 backdrop-blur-[1px]"
        }`}
      />

      {/* Spotlight: a transparent hole over the target with a huge shadow that
          dims everything else, plus a themed accent ring. Purely decorative. */}
      {anchored && targetRect && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-sm ring-2 ring-accent ring-offset-2 ring-offset-transparent transition-all motion-reduce:transition-none"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
          }}
        />
      )}

      <div
        key={step.id}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        onKeyDown={onKeyDown}
        style={
          placement
            ? { position: "absolute", top: placement.top, left: placement.left }
            : { position: "absolute", top: 0, left: 0 }
        }
        className={`z-10 w-[21rem] max-w-[calc(100vw-1rem)] overflow-visible rounded-md border border-border-strong bg-surface text-primary shadow-2xl ${
          placement ? "motion-safe:animate-print-in" : "invisible"
        }`}
      >
        {/* Arrow/pointer aimed back at the anchored target. */}
        {anchored && placement && (
          <div
            aria-hidden="true"
            className={`absolute h-3 w-3 rotate-45 bg-surface ${
              side === "bottom"
                ? "border-l border-t border-border-strong"
                : side === "top"
                  ? "border-r border-b border-border-strong"
                  : side === "right"
                    ? "border-b border-l border-border-strong"
                    : "border-r border-t border-border-strong"
            }`}
            style={{
              left: placement.arrowLeft,
              top: placement.arrowTop,
              transform: "translate(-50%, -50%) rotate(45deg)",
            }}
          />
        )}

        {/* Per-theme accent rule — pulls the active theme's brand color. */}
        <div
          className="h-1.5 w-full overflow-hidden rounded-t-md bg-accent"
          aria-hidden="true"
        />

        <div className="p-5 sm:p-6">
          {/* Eyebrow: signals the app + the active theme (tasteful per-theme accent). */}
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="label text-[9px] text-accent">
              Getting Started · {themeDef.label}
            </span>
            <span className="label text-[9px] text-muted num">
              {index + 1} / {steps.length}
            </span>
          </div>

          <h2
            id={titleId}
            className="font-display text-xl font-black leading-tight text-primary sm:text-2xl"
          >
            {step.title}
          </h2>

          <p
            id={bodyId}
            className="mt-2.5 text-sm leading-relaxed text-secondary"
          >
            {step.body}
          </p>

          {/* Progress dots. */}
          <div className="mt-5 flex items-center gap-1.5" aria-hidden="true">
            {steps.map((s, i) => (
              <span
                key={s.id}
                className={`h-1.5 rounded-full transition-all ${
                  i === index
                    ? "w-5 bg-accent"
                    : i < index
                      ? "w-1.5 bg-accent/60"
                      : "w-1.5 bg-surface-muted"
                }`}
              />
            ))}
          </div>

          {/* Controls. */}
          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={close}
              className="btn-ghost !min-h-0 !px-2 !py-1.5 text-[11px]"
            >
              {isLast ? "Close" : "Skip"}
            </button>

            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  type="button"
                  onClick={goBack}
                  className="btn-secondary !min-h-0 !px-3 !py-2 text-[11px]"
                >
                  Back
                </button>
              )}
              <button
                ref={nextBtnRef}
                type="button"
                onClick={goNext}
                className="btn-primary !min-h-0 !px-4 !py-2 text-[11px]"
              >
                {isLast ? "Done" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
