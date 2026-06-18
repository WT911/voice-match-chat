import React from "react";
import { useSpeechSynthesis, TTSState } from "../hooks/useSpeechSynthesis";

interface SpeakButtonProps {
  /** Text to speak */
  text: string;
  /** Compact mode for inline use */
  compact?: boolean;
}

function PlayIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
      />
    </svg>
  );
}

export function SpeakButton({ text, compact = false }: SpeakButtonProps) {
  const { state, isSupported, speak, cancel, togglePause } = useSpeechSynthesis({
    lang: "zh-CN",
    rate: 1.0,
  });

  if (!isSupported) return null;

  const isActive = state === "speaking" || state === "paused";

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isActive) {
      speak(text);
    } else if (state === "speaking") {
      togglePause();
    } else {
      cancel();
    }
  };

  const buttonLabel =
    state === "speaking" ? "暂停" : state === "paused" ? "继续" : "朗读";

  if (compact) {
    return (
      <button
        onClick={handleClick}
        title={buttonLabel}
        className={`p-1 rounded-md transition-colors ${
          isActive
            ? "text-blue-500 bg-blue-50"
            : "text-gray-400 hover:text-blue-500 hover:bg-blue-50"
        }`}
      >
        {state === "speaking" ? (
          <PauseIcon />
        ) : state === "paused" ? (
          <PlayIcon />
        ) : (
          <PlayIcon />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors ${
        isActive
          ? "text-blue-600 bg-blue-50 border border-blue-200"
          : "text-gray-400 hover:text-blue-500 hover:bg-blue-50 border border-transparent"
      }`}
    >
      {state === "speaking" ? (
        <>
          <PauseIcon />
          <span className="hidden sm:inline">暂停</span>
        </>
      ) : state === "paused" ? (
        <>
          <PlayIcon />
          <span className="hidden sm:inline">继续</span>
        </>
      ) : (
        <>
          <PlayIcon />
          <span className="hidden sm:inline">朗读</span>
        </>
      )}
    </button>
  );
}
