import React from "react";

interface MatchWaitingViewProps {
  queueSize: number;
  estimatedWait: number;
  remainingSeconds?: number;
  onCancel: () => void;
  isTimeout?: boolean;
  onRetry?: () => void;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function MatchWaitingView({
  queueSize,
  estimatedWait,
  remainingSeconds,
  onCancel,
  isTimeout,
  onRetry,
}: MatchWaitingViewProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      {isTimeout ? (
        <>
          <div className="text-6xl mb-6">⏰</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">匹配超时</h2>
          <p className="text-sm text-gray-500 mb-8">当前在线人数较少，请稍后再试</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-8 py-3 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 transition-all"
            >
              重新匹配
            </button>
          )}
          <button onClick={onCancel} className="mt-3 text-sm text-gray-400 hover:text-gray-600">
            返回
          </button>
        </>
      ) : (
        <>
          {/* Matching animation */}
          <div className="relative mb-8">
            <div className="w-24 h-24 rounded-full bg-purple-100 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-purple-200 flex items-center justify-center animate-pulse">
                <span className="text-3xl">🎤</span>
              </div>
            </div>
            {/* Ripple effects */}
            <div className="absolute inset-0 rounded-full border-4 border-purple-200 animate-ping opacity-75" />
            <div
              className="absolute -inset-4 rounded-full border-2 border-purple-100 animate-ping opacity-50"
              style={{ animationDelay: "0.5s" }}
            />
          </div>

          <h2 className="text-xl font-bold text-gray-800 mb-2">正在为你匹配</h2>

          {/* 倒计时显示 */}
          {remainingSeconds && remainingSeconds > 0 ? (
            <p className="text-sm text-purple-500 mb-2 font-mono font-medium">
              剩余 {formatTime(remainingSeconds)}
            </p>
          ) : null}

          <p className="text-sm text-gray-500 mb-8">
            {queueSize > 0
              ? `当前队列 ${queueSize} 人，预计等待 ${estimatedWait} 秒`
              : "正在寻找合适的聊天对象..."}
          </p>

          {/* Loading dots */}
          <div className="flex items-center gap-1.5 mb-8">
            <span className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>

          <button
            onClick={onCancel}
            className="px-6 py-2.5 border border-gray-200 text-gray-500 rounded-xl text-sm hover:bg-gray-50 transition-all"
          >
            取消匹配
          </button>
        </>
      )}
    </div>
  );
}
