import React from "react";
import { useSpeechRecognition, RecognitionState } from "../hooks/useSpeechRecognition";

interface VoiceInputButtonProps {
  /** Called when final transcript is available */
  onTranscript: (text: string) => void;
  /** Called with interim text for live display */
  onInterimText?: (text: string) => void;
  /** Whether input is disabled */
  disabled?: boolean;
}

function MicIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
      />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
      />
    </svg>
  );
}

export function VoiceInputButton({
  onTranscript,
  onInterimText,
  disabled = false,
}: VoiceInputButtonProps) {
  const { state, isSupported, interimText, startListening, stopListening } =
    useSpeechRecognition({
      lang: "zh-CN",
      onResult: (transcript) => {
        onTranscript(transcript);
      },
      onInterim: (text) => {
        onInterimText?.(text);
      },
    });

  if (!isSupported) return null;

  const isListening = state === "listening";

  const handleClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={isListening ? "停止录音" : "语音输入"}
      className={`relative h-10 w-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
        isListening
          ? "bg-red-50 text-red-500 shadow-sm shadow-red-200"
          : "bg-gray-50 text-gray-400 hover:text-blue-500 hover:bg-blue-50"
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {isListening ? (
        <>
          <span className="absolute inset-0 rounded-xl bg-red-400/20 animate-ping" />
          <MicIcon active />
        </>
      ) : (
        <MicIcon active={false} />
      )}
    </button>
  );
}
