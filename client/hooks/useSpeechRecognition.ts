import { useState, useRef, useCallback, useEffect } from "react";

// TypeScript declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export type RecognitionState = "idle" | "listening" | "error" | "unsupported";

interface UseSpeechRecognitionOptions {
  /** Language for recognition, default zh-CN */
  lang?: string;
  /** Callback when final transcript is available */
  onResult?: (transcript: string) => void;
  /** Callback for interim results (live display) */
  onInterim?: (transcript: string) => void;
}

export function useSpeechRecognition({
  lang = "zh-CN",
  onResult,
  onInterim,
}: UseSpeechRecognitionOptions = {}) {
  const [state, setState] = useState<RecognitionState>("idle");
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isSupportedRef = useRef(false);

  // Check support
  useEffect(() => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      isSupportedRef.current = true;
    } else {
      setState("unsupported");
    }
  }, []);

  const startListening = useCallback(() => {
    if (!isSupportedRef.current) {
      setState("unsupported");
      return;
    }

    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    // Abort any existing recognition
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = lang;

    let finalTranscript = "";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (interim) {
        setInterimText(interim);
        onInterim?.(interim);
      }
      if (finalTranscript) {
        setInterimText("");
        onResult?.(finalTranscript);
        onInterim?.("");
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error, event.message);
      if (event.error === "no-speech") {
        // No speech detected, just stop silently
        setState("idle");
        return;
      }
      setState("error");
    };

    recognition.onend = () => {
      setState("idle");
      setInterimText("");
      onInterim?.("");
    };

    recognitionRef.current = recognition;
    setState("listening");
    recognition.start();
  }, [lang, onResult, onInterim]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setState("idle");
    setInterimText("");
    onInterim?.("");
  }, [onInterim]);

  const abortListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    setState("idle");
    setInterimText("");
    onInterim?.("");
  }, [onInterim]);

  return {
    state,
    isSupported: isSupportedRef.current,
    interimText,
    startListening,
    stopListening,
    abortListening,
  };
}
