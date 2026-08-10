import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createSpeechController,
  type SpeechController,
  type SpeechSupport,
} from "@/lib/mock/speech";

/**
 * Thin React hook over the pure `@/lib/mock/speech` controller. It owns the
 * transient "listening" UI state and forwards recognition results, but stores
 * NOTHING beyond the current utterance's interim text (which is cleared as soon
 * as the caller consumes the final transcript). If the browser lacks the Web
 * Speech recognition API, `support` reflects that and all actions no-op — the
 * caller falls back to the typed input path.
 */
export interface UseMockSpeech {
  support: SpeechSupport;
  /** Convenience: can we listen for spoken answers? */
  canListen: boolean;
  listening: boolean;
  /** Live interim transcript for the current utterance (display only). */
  interim: string;
  /** Begin listening; `onFinal` fires once with the final transcript. */
  startListening: (onFinal: (text: string) => void) => void;
  stopListening: () => void;
}

export function useMockSpeech(): UseMockSpeech {
  const controllerRef = useRef<SpeechController | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = createSpeechController();
  }
  const controller = controllerRef.current;

  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const onFinalRef = useRef<((text: string) => void) | null>(null);

  const stopListening = useCallback(() => {
    controller.stop();
    setListening(false);
    setInterim("");
  }, [controller]);

  const startListening = useCallback(
    (onFinal: (text: string) => void) => {
      if (!controller.support.recognition) return;
      onFinalRef.current = onFinal;
      setInterim("");
      const started = controller.listen({
        onResult: (transcript, isFinal) => {
          setInterim(transcript);
          if (isFinal) {
            onFinalRef.current?.(transcript);
            onFinalRef.current = null;
          }
        },
        onError: () => {
          setListening(false);
          setInterim("");
        },
        onEnd: () => {
          setListening(false);
        },
      });
      setListening(started);
    },
    [controller],
  );

  // Stop any in-flight recognition when the consumer unmounts.
  useEffect(() => {
    return () => {
      controller.stop();
    };
  }, [controller]);

  return useMemo(
    () => ({
      support: controller.support,
      canListen: controller.support.recognition,
      listening,
      interim,
      startListening,
      stopListening,
    }),
    [controller, listening, interim, startListening, stopListening],
  );
}
