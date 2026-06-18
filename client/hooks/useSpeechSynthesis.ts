import { useState, useRef, useCallback, useEffect } from "react";

export type TTSState = "idle" | "speaking" | "paused";

interface UseSpeechSynthesisOptions {
  /** Language, default zh-CN */
  lang?: string;
  /** Speech rate, default 1.0 */
  rate?: number;
  /** Pitch, default 1.0 */
  pitch?: number;
}

export function useSpeechSynthesis({
  lang = "zh-CN",
  rate = 1.0,
  pitch = 1.0,
}: UseSpeechSynthesisOptions = {}) {
  const [state, setState] = useState<TTSState>("idle");
  const [currentText, setCurrentText] = useState("");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isSupportedRef = useRef(typeof window !== "undefined" && "speechSynthesis" in window);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (utteranceRef.current) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speak = useCallback((text: string) => {
    if (!isSupportedRef.current) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = pitch;

    utterance.onstart = () => {
      setState("speaking");
      setCurrentText(text);
    };

    utterance.onend = () => {
      setState("idle");
      setCurrentText("");
      utteranceRef.current = null;
    };

    utterance.onerror = (event) => {
      console.error("Speech synthesis error:", event);
      setState("idle");
      setCurrentText("");
      utteranceRef.current = null;
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [lang, rate, pitch]);

  const pause = useCallback(() => {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      setState("paused");
    }
  }, []);

  const resume = useCallback(() => {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setState("speaking");
    }
  }, []);

  const cancel = useCallback(() => {
    window.speechSynthesis.cancel();
    setState("idle");
    setCurrentText("");
    utteranceRef.current = null;
  }, []);

  const togglePause = useCallback(() => {
    if (state === "speaking") {
      pause();
    } else if (state === "paused") {
      resume();
    }
  }, [state, pause, resume]);

  return {
    state,
    isSupported: isSupportedRef.current,
    currentText,
    speak,
    pause,
    resume,
    cancel,
    togglePause,
  };
}
