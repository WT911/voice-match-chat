import React, { useEffect, useState, useCallback, useRef } from "react";
import { useVoiceMatch } from "../hooks/useVoiceMatch";
import { useWebRTC } from "../hooks/useWebRTC";
import { GenderSelectModal } from "./GenderSelectModal";
import { MatchWaitingView } from "./MatchWaitingView";
import { MatchConnectedView } from "./MatchConnectedView";
import { MatchRatingView } from "./MatchRatingView";
import { LevelDisplay } from "./LevelDisplay";

// ============================================
// 类型定义
// ============================================

const ANIMAL_AVATARS = [
  "🐶","🐱","🐼","🐨","🐰","🦊","🐸","🐵",
  "🐮","🐷","🐹","🐭","🐻","🦁","🐯","🐔",
  "🐧","🐦","🦄","🐙",
];

const ZODIAC_EMOJI: Record<string, string> = {
  "白羊座":"♈","金牛座":"♉","双子座":"♊","巨蟹座":"♋",
  "狮子座":"♌","处女座":"♍","天秤座":"♎","天蝎座":"♏",
  "射手座":"♐","摩羯座":"♑","水瓶座":"♒","双鱼座":"♓",
};

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// ============================================
// 挂断确认弹窗
// ============================================

function HangUpConfirmModal({
  callDuration,
  onCancel,
  onConfirm,
}: {
  callDuration: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-6 text-center">
        <div className="text-5xl mb-4">📞</div>
        <h3 className="text-lg font-bold text-gray-800 mb-1">确定要挂断吗？</h3>
        <p className="text-sm text-gray-500 mb-4">通话时长: {formatTime(callDuration)}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 border border-gray-200 text-gray-500 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-all"
          >
            确认挂断
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 声音名片播放按钮
// ============================================

function VoiceIntroPlayer({ voiceIntro }: { voiceIntro: string }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlay = () => {
    if (!voiceIntro) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(voiceIntro);
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setPlaying(true);
    }
  };

  if (!voiceIntro) return null;

  return (
    <button
      onClick={handlePlay}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
        playing
          ? "bg-purple-100 text-purple-600"
          : "bg-gray-100 text-gray-500 hover:bg-purple-50 hover:text-purple-500"
      }`}
    >
      {playing ? (
        <>
          <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
          播放中...
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          </svg>
          声音名片
        </>
      )}
    </button>
  );
}

// ============================================
// VoiceMatchPage
// ============================================

interface VoiceMatchPageProps {
  wsUrl: string;
}

function getSavedUser(): { gender: "male" | "female"; nickname: string; tags: string[]; zodiac: string; avatarId: number } | null {
  try {
    const data = localStorage.getItem("voice_match_user");
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

function saveUser(data: { gender: "male" | "female"; nickname: string; tags: string[]; zodiac: string; avatarId: number }) {
  localStorage.setItem("voice_match_user", JSON.stringify(data));
}

export function VoiceMatchPage({ wsUrl }: VoiceMatchPageProps) {
  const savedUser = getSavedUser();
  const [showGenderModal, setShowGenderModal] = useState(!savedUser);
  const [showHangUpModal, setShowHangUpModal] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [textInput, setTextInput] = useState("");
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    matchState,
    currentUser,
    peer,
    matchId,
    isInitiator,
    isConnected,
    queueSize,
    estimatedWait,
    remainingMatchSeconds,
    onlineCount,
    lastExperienceGained,
    levelUpInfo,
    timeLimit,
    unlimited,
    textMessages,
    register,
    startMatch,
    cancelMatch,
    endCall,
    sendLike,
    sendTextMessage,
    submitRating,
    sendSignal,
    setSignalHandler,
    reset,
  } = useVoiceMatch({ wsUrl });

  const {
    connectionState,
    startCall,
    handleSignal,
    endCall: endWebRTC,
  } = useWebRTC({ matchId, isInitiator, onSignal: sendSignal });

  // Set signal handler
  useEffect(() => {
    setSignalHandler((type: string, data: any) => {
      handleSignal(type, data.sdp, data.candidate);
    });
  }, [handleSignal, setSignalHandler]);

  // Auto-start WebRTC when matched
  useEffect(() => {
    if (matchState === "matched" && matchId) {
      startCall();
    }
  }, [matchState, matchId, startCall]);

  // Auto-register
  useEffect(() => {
    if (savedUser && isConnected && !currentUser) {
      register(savedUser.gender, savedUser.nickname, savedUser.tags, savedUser.zodiac, savedUser.avatarId);
    }
  }, [savedUser, isConnected, currentUser, register]);

  // Call timer
  useEffect(() => {
    if (matchState !== "matched") {
      setCallSeconds(0);
      setTimeRemaining(null);
      return;
    }
    const timer = setInterval(() => {
      setCallSeconds((s) => {
        const next = s + 1;
        if (!unlimited && timeLimit > 0) {
          setTimeRemaining(Math.max(0, timeLimit - next));
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [matchState, unlimited, timeLimit]);

  // Scroll text messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [textMessages]);

  // Handle gender select
  const handleGenderSelect = useCallback((data: {
    gender: "male" | "female"; nickname: string; tags: string[]; zodiac: string; avatarId: number;
  }) => {
    saveUser(data);
    setShowGenderModal(false);
    register(data.gender, data.nickname, data.tags, data.zodiac, data.avatarId);
  }, [register]);

  // Handle end call with confirmation
  const handleEndCallClick = useCallback(() => {
    setShowHangUpModal(true);
  }, []);

  const handleConfirmHangUp = useCallback(() => {
    setShowHangUpModal(false);
    endWebRTC();
    endCall();
  }, [endWebRTC, endCall]);

  const handleCancelHangUp = useCallback(() => {
    setShowHangUpModal(false);
  }, []);

  // Send text message
  const handleSendText = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    sendTextMessage(textInput.trim());
    setTextInput("");
  }, [textInput, sendTextMessage]);

  // Rating
  const handleRatingSubmit = useCallback((score: number, tags: string[], comment?: string) => {
    submitRating(score, tags, comment);
  }, [submitRating]);

  const handleSkipRating = useCallback(() => {
    submitRating(3, []);
    reset();
  }, [submitRating, reset]);

  // ==========================================
  // Render
  // ==========================================

  const renderHeader = () => (
    <div className="h-14 px-4 flex items-center justify-between bg-white border-b border-gray-100 shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-xl">🎤</span>
        <h2 className="font-semibold text-gray-800 text-sm">语音匹配</h2>
      </div>
      <div className="flex items-center gap-2">
        {onlineCount > 0 && (
          <span className="text-xs text-green-500 bg-green-50 px-2 py-0.5 rounded-full">
            {onlineCount} 人在线
          </span>
        )}
        {currentUser && (
          <LevelDisplay level={currentUser.level} experience={currentUser.experience} compact />
        )}
      </div>
    </div>
  );

  const renderContent = () => {
    if (showGenderModal) {
      return <div className="flex-1 flex items-center justify-center"><p className="text-gray-400 text-sm">请先设置信息</p></div>;
    }
    if (!isConnected) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-gray-500 text-sm">正在连接服务器...</p>
          </div>
        </div>
      );
    }
    if (!currentUser) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-gray-500 text-sm">正在加载...</p>
        </div>
      );
    }

    switch (matchState) {
      case "idle":
        return (
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="text-6xl mb-4">
              {ANIMAL_AVATARS[(currentUser.avatarId || 1) - 1] || "🐶"}
            </div>
            <h2 className="text-lg font-bold text-gray-800 mb-1">{currentUser.nickname}</h2>
            <p className="text-xs text-gray-500 mb-1">
              {ZODIAC_EMOJI[currentUser.zodiac] || ""} {currentUser.zodiac || "未设置星座"}
            </p>
            {currentUser.tags.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1 mb-4">
                {currentUser.tags.map((t) => (
                  <span key={t} className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full text-xs">{t}</span>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400 text-center mb-4">
              随机匹配一位异性用户进行语音聊天
            </p>
            <LevelDisplay level={currentUser.level} experience={currentUser.experience} />
            <button
              onClick={startMatch}
              className="mt-6 w-full max-w-xs py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition-all active:scale-98"
            >
              开始匹配
            </button>
            {onlineCount > 0 && (
              <p className="text-xs text-gray-400 mt-3">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block mr-1" />
                当前在线 {onlineCount} 人
              </p>
            )}
          </div>
        );

      case "matching":
        return (
          <MatchWaitingView
            queueSize={queueSize}
            estimatedWait={estimatedWait}
            remainingSeconds={remainingMatchSeconds}
            onCancel={cancelMatch}
          />
        );

      case "matched":
        return peer ? (
          <div className="flex-1 flex flex-col bg-gradient-to-b from-purple-50 to-white overflow-hidden">
            {/* Peer info */}
            <div className="px-4 py-4 text-center shrink-0">
              <div className="text-5xl mb-2">{ANIMAL_AVATARS[(peer.avatarId || 1) - 1] || "🐶"}</div>
              <h3 className="text-lg font-bold text-gray-800">{peer.nickname}</h3>
              <div className="flex items-center justify-center gap-2 mt-1">
                <span className="text-xs text-gray-500">
                  {ZODIAC_EMOJI[peer.zodiac] || ""} {peer.zodiac}
                </span>
                <span className={`text-xs font-medium ${
                  ["text-amber-700","text-gray-500","text-yellow-600","text-cyan-500","text-blue-600","text-purple-600","text-orange-600"][peer.level] || "text-gray-500"
                }`}>
                  Lv.{peer.level}
                </span>
                {peer.pricePerMinute > 0 && (
                  <span className="text-xs text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">💰{peer.pricePerMinute}/分</span>
                )}
              </div>
              {peer.tags.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1 mt-2">
                  {peer.tags.map((t) => (
                    <span key={t} className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">{t}</span>
                  ))}
                </div>
              )}
              <VoiceIntroPlayer voiceIntro={peer.voiceIntro} />
            </div>

            {/* Timer + limit */}
            <div className="text-center py-2 shrink-0">
              <div className="text-3xl font-mono font-bold text-gray-700">
                {formatTime(callSeconds)}
              </div>
              {!unlimited && timeRemaining !== null && timeRemaining > 0 && (
                <p className="text-xs text-orange-500 mt-1">
                  限时剩余 {formatTime(timeRemaining)} · 互赞解锁无限时
                </p>
              )}
              {unlimited && (
                <p className="text-xs text-green-500 mt-1">💚 已解锁无限时通话</p>
              )}
              {timeRemaining !== null && timeRemaining <= 30 && !unlimited && (
                <p className="text-xs text-red-500 mt-1 animate-pulse">⏰ 时间即将用完</p>
              )}
              <div className={`flex items-center justify-center gap-1.5 mt-1 text-xs ${
                connectionState === "connected" ? "text-green-500" : "text-yellow-500"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${connectionState === "connected" ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`} />
                {connectionState === "connected" ? "通话中" : "连接中..."}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-6 py-3 shrink-0">
              <button
                onClick={sendLike}
                className="w-14 h-14 bg-pink-100 rounded-full flex items-center justify-center text-2xl hover:bg-pink-200 transition-all active:scale-90 shadow-sm"
                title="点赞"
              >
                ❤️
              </button>
              <button
                onClick={handleEndCallClick}
                className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center hover:bg-red-200 transition-all active:scale-90 shadow-sm"
                title="挂断"
              >
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
                </svg>
              </button>
            </div>

            {/* Text chat area */}
            <div className="flex-1 flex flex-col bg-white mx-3 mb-3 rounded-xl border border-gray-100 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {textMessages.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">通话中也可以发文字消息哦</p>
                )}
                {textMessages.map((msg) => {
                  const isMe = msg.senderId === currentUser.userId;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className={`px-3 py-1.5 rounded-2xl max-w-[75%] text-xs ${
                        isMe
                          ? "bg-purple-500 text-white rounded-br-sm"
                          : "bg-gray-100 text-gray-700 rounded-bl-sm"
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={handleSendText} className="flex items-center gap-2 p-2 border-t border-gray-50">
                <input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="发送消息..."
                  className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-full focus:outline-none focus:ring-1 focus:ring-purple-300"
                />
                <button
                  type="submit"
                  disabled={!textInput.trim()}
                  className="px-4 py-2 bg-purple-500 text-white text-xs rounded-full font-medium hover:bg-purple-600 disabled:bg-gray-200 disabled:text-gray-400 transition-all"
                >
                  发送
                </button>
              </form>
            </div>
          </div>
        ) : null;

      case "rating":
        return peer ? (
          <MatchRatingView
            peer={{ nickname: peer.nickname, gender: peer.gender, level: peer.level }}
            experienceGained={lastExperienceGained}
            onSubmit={handleRatingSubmit}
            onSkip={handleSkipRating}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <button onClick={reset} className="text-purple-500 text-sm">返回</button>
          </div>
        );

      case "timeout":
        return (
          <MatchWaitingView
            queueSize={0}
            estimatedWait={0}
            remainingSeconds={0}
            onCancel={() => reset()}
            isTimeout
            onRetry={startMatch}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50/50">
      {renderHeader()}
      {renderContent()}
      {showGenderModal && <GenderSelectModal onSelect={handleGenderSelect} />}
      {showHangUpModal && (
        <HangUpConfirmModal
          callDuration={callSeconds}
          onCancel={handleCancelHangUp}
          onConfirm={handleConfirmHangUp}
        />
      )}
      {levelUpInfo && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-xl px-6 py-4 z-50 animate-bounce">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎉</span>
            <div>
              <p className="font-bold text-gray-800">等级提升！</p>
              <p className="text-sm text-gray-500">Lv.{levelUpInfo.previousLevel} → Lv.{levelUpInfo.newLevel}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
