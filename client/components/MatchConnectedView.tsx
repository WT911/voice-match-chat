import React, { useEffect, useState } from "react";

interface PeerInfo {
  userId: string;
  nickname: string;
  level: number;
  gender: "male" | "female";
}

interface MatchConnectedViewProps {
  peer: PeerInfo;
  callDuration: number;
  connectionState: string;
  onEndCall: () => void;
}

const LEVEL_NAMES = ["青铜", "白银", "黄金", "铂金", "钻石", "王者", "传奇"];
const LEVEL_COLORS = [
  "text-amber-700", "text-gray-500", "text-yellow-600",
  "text-cyan-500", "text-blue-600", "text-purple-600", "text-orange-600",
];

export function MatchConnectedView({ peer, callDuration, connectionState, onEndCall }: MatchConnectedViewProps) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const isConnected = connectionState === "connected";

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-b from-purple-50 to-white">
      {/* Peer avatar */}
      <div className="relative mb-6">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center text-5xl shadow-lg ${
          peer.gender === "male" ? "bg-blue-100" : "bg-pink-100"
        }`}>
          {peer.gender === "male" ? "👨" : "👩"}
        </div>
        {isConnected && (
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          </div>
        )}
      </div>

      {/* Peer info */}
      <h2 className="text-xl font-bold text-gray-800 mb-1">{peer.nickname}</h2>
      <p className={`text-sm font-medium ${LEVEL_COLORS[peer.level] || "text-gray-500"} mb-6`}>
        {LEVEL_NAMES[peer.level]} · Lv.{peer.level}
      </p>

      {/* Timer */}
      <div className="text-4xl font-mono font-bold text-gray-700 mb-4">
        {formatTime(seconds)}
      </div>

      {/* Connection status */}
      <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-8 ${
        isConnected ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"
      }`}>
        <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`} />
        {isConnected ? "通话中" : "连接中..."}
      </div>

      {/* End call button */}
      <button
        onClick={onEndCall}
        className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-all active:scale-95"
      >
        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
        </svg>
      </button>
      <p className="text-sm text-gray-400 mt-3">点击挂断</p>
    </div>
  );
}
