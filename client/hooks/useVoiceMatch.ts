import { useState, useCallback, useRef, useEffect } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";

// ============================================
// 类型定义 - 与后端 voice-match-types.ts 对齐
// ============================================

export type MatchState = "idle" | "matching" | "matched" | "rating" | "timeout";

export interface CallRecord {
  matchId: string;
  peerId: string;
  peerNickname: string;
  peerGender: "male" | "female";
  peerAvatarId: number;
  peerLevel: number;
  callDuration: number;
  startedAt: string;
  myRating?: number;
  unlimited: boolean;
}

export interface TextMessage {
  id: string;
  senderId: string;
  content: string;
  timestamp: string;
}

export interface PeerInfo {
  userId: string;
  nickname: string;
  level: number;
  gender: "male" | "female";
  tags: string[];
  zodiac: string;
  avatarId: number;
  voiceIntro: string;
  pricePerMinute: number;
}

export interface CurrentUser {
  userId: string;
  nickname: string;
  gender: "male" | "female";
  tags: string[];
  zodiac: string;
  voiceIntro: string;
  avatarId: number;
  level: number;
  experience: number;
  pricePerMinute: number;
  stats: UserStats;
  callRecords: CallRecord[];
}

export interface UserStats {
  totalMatches: number;
  totalCallDuration: number;
  totalRatings: number;
  totalRatingScore: number;
  currentStreak: number;
  lastMatchDate: string;
  createdAt: string;
}

interface UseVoiceMatchOptions {
  wsUrl: string;
}

export function useVoiceMatch({ wsUrl }: UseVoiceMatchOptions) {
  // ---- 核心状态 ----
  const [matchState, setMatchState] = useState<MatchState>("idle");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [peer, setPeer] = useState<PeerInfo | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [isInitiator, setIsInitiator] = useState(false);

  // ---- 匹配队列 ----
  const [queueSize, setQueueSize] = useState(0);
  const [estimatedWait, setEstimatedWait] = useState(0);
  const [remainingMatchSeconds, setRemainingMatchSeconds] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);

  // ---- 通话限时 & 互赞 ----
  const [timeLimit, setTimeLimit] = useState(0);
  const [unlimited, setUnlimited] = useState(false);
  const [myLiked, setMyLiked] = useState(false);
  const [peerLiked, setPeerLiked] = useState(false);

  // ---- 文字聊天 ----
  const [textMessages, setTextMessages] = useState<TextMessage[]>([]);

  // ---- 评分/经验 ----
  const [lastExperienceGained, setLastExperienceGained] = useState(0);
  const [levelUpInfo, setLevelUpInfo] = useState<{
    previousLevel: number;
    newLevel: number;
  } | null>(null);

  // ---- WebRTC 信号转发 ----
  const pendingSignalRef = useRef<((type: string, data: any) => void) | null>(null);

  // ---- WebSocket ----
  const { sendJsonMessage, readyState, lastJsonMessage } = useWebSocket(wsUrl, {
    shouldReconnect: () => true,
    reconnectAttempts: 10,
    reconnectInterval: 3000,
  });

  const isConnected = readyState === ReadyState.OPEN;

  // ============================================
  // 处理服务端消息
  // ============================================
  useEffect(() => {
    if (!lastJsonMessage) return;
    const msg = lastJsonMessage as any;

    switch (msg.type) {

      // --- 注册确认 ---
      case "voice_match:registered":
        setCurrentUser({
          userId: msg.userId,
          nickname: msg.nickname,
          gender: msg.gender,
          tags: msg.tags || [],
          zodiac: msg.zodiac || "",
          voiceIntro: msg.voiceIntro || "",
          avatarId: msg.avatarId || 1,
          level: msg.level,
          experience: msg.experience,
          pricePerMinute: msg.pricePerMinute || 0,
          stats: msg.stats,
          callRecords: msg.callRecords || [],
        });
        break;

      // --- 匹配中状态更新 ---
      case "voice_match:matching":
        setQueueSize(msg.queueSize);
        setEstimatedWait(msg.estimatedWait);
        setRemainingMatchSeconds(msg.remainingSeconds || 0);
        setOnlineCount(msg.onlineCount || 0);
        break;

      // --- 匹配成功 ---
      case "voice_match:match_found":
        setMatchState("matched");
        setMatchId(msg.matchId);
        setPeer(msg.peer);
        setIsInitiator(msg.initiator);
        setTimeLimit(msg.timeLimit || 0);
        setUnlimited(false);
        setMyLiked(false);
        setPeerLiked(false);
        setTextMessages([]);
        break;

      // --- 匹配超时 ---
      case "voice_match:match_timeout":
        setMatchState("timeout");
        break;

      // --- WebRTC 信号转发 ---
      case "voice_match:signal_forward":
        if (pendingSignalRef.current) {
          pendingSignalRef.current(msg.signalType, {
            sdp: msg.sdp,
            candidate: msg.candidate,
          });
        }
        break;

      // --- 对方断开 ---
      case "voice_match:peer_disconnected":
        setMatchState("rating");
        break;

      // --- 通话限时警告 ---
      case "voice_match:time_warning":
        if (msg.expired) {
          // 时间到，后端自动挂断
          setMatchState("rating");
        }
        break;

      // --- 互赞解锁无限时 ---
      case "voice_match:unlimited":
        setUnlimited(true);
        break;

      // --- 收到对方点赞 ---
      case "voice_match:like_received":
        setPeerLiked(true);
        if (msg.mutual) {
          setUnlimited(true);
        }
        break;

      // --- 收到文字消息 ---
      case "voice_match:text_message":
        setTextMessages((prev) => [
          ...prev,
          {
            id: msg.messageId,
            senderId: msg.senderId,
            content: msg.content,
            timestamp: msg.timestamp,
          },
        ]);
        break;

      // --- 在线人数更新 ---
      case "voice_match:online_count":
        setOnlineCount(msg.male + msg.female);
        break;

      // --- 被拉黑通知 ---
      case "voice_match:blocked":
        // 静默处理，前端可选提示
        break;

      // --- 通话记录 ---
      case "voice_match:call_records":
        if (currentUser) {
          setCurrentUser({
            ...currentUser,
            callRecords: msg.records,
          });
        }
        break;

      // --- 评分确认 ---
      case "voice_match:rating_confirmed":
        setLastExperienceGained(msg.experienceGained);
        break;

      // --- 等级更新 ---
      case "voice_match:level_update":
        setLevelUpInfo({
          previousLevel: msg.previousLevel,
          newLevel: msg.newLevel,
        });
        if (currentUser) {
          setCurrentUser({
            ...currentUser,
            level: msg.newLevel,
            experience: msg.experience,
          });
        }
        break;

      // --- 统计更新 ---
      case "voice_match:stats_update":
        if (currentUser) {
          setCurrentUser({
            ...currentUser,
            stats: msg.stats,
            level: msg.level,
            experience: msg.experience,
            callRecords: msg.callRecords || currentUser.callRecords,
          });
        }
        break;
    }
  }, [lastJsonMessage]);

  // ============================================
  // 操作方法
  // ============================================

  // 注册（增强版：支持 tags/zodiac/avatarId）
  const register = useCallback(
    (gender: "male" | "female", nickname: string, tags: string[] = [], zodiac: string = "", avatarId: number = 1) => {
      sendJsonMessage({
        type: "voice_match:register",
        gender,
        nickname,
        tags,
        zodiac,
        avatarId,
      });
    },
    [sendJsonMessage]
  );

  // 开始匹配
  const startMatch = useCallback(() => {
    setMatchState("matching");
    setQueueSize(0);
    setEstimatedWait(0);
    setRemainingMatchSeconds(0);
    setLevelUpInfo(null);
    sendJsonMessage({ type: "voice_match:start" });
  }, [sendJsonMessage]);

  // 取消匹配
  const cancelMatch = useCallback(() => {
    setMatchState("idle");
    sendJsonMessage({ type: "voice_match:cancel" });
  }, [sendJsonMessage]);

  // 结束通话
  const endCall = useCallback(() => {
    if (matchId) {
      sendJsonMessage({ type: "voice_match:end_call", matchId });
    }
  }, [matchId, sendJsonMessage]);

  // 发送点赞
  const sendLike = useCallback(() => {
    if (matchId) {
      setMyLiked(true);
      sendJsonMessage({ type: "voice_match:send_like", matchId });
    }
  }, [matchId, sendJsonMessage]);

  // 发送文字消息
  const sendTextMessage = useCallback(
    (content: string) => {
      if (matchId) {
        sendJsonMessage({ type: "voice_match:text_message", matchId, content });
      }
    },
    [matchId, sendJsonMessage]
  );

  // 提交评分
  const submitRating = useCallback(
    (score: number, tags: string[], comment?: string) => {
      if (matchId) {
        sendJsonMessage({
          type: "voice_match:rate",
          matchId,
          score,
          tags,
          comment,
        });
        setMatchState("idle");
        setPeer(null);
        setMatchId(null);
        setLevelUpInfo(null);
        setTextMessages([]);
        setUnlimited(false);
        setMyLiked(false);
        setPeerLiked(false);
      }
    },
    [matchId, sendJsonMessage]
  );

  // 发送 WebRTC 信号
  const sendSignal = useCallback(
    (signalType: "offer" | "answer" | "ice_candidate", data: any) => {
      if (matchId) {
        sendJsonMessage({
          type: "voice_match:signal",
          matchId,
          signalType,
          sdp: data.sdp,
          candidate: data.candidate,
        });
      }
    },
    [matchId, sendJsonMessage]
  );

  // 设置 WebRTC 信号处理器
  const setSignalHandler = useCallback(
    (handler: (type: string, data: any) => void) => {
      pendingSignalRef.current = handler;
    },
    []
  );

  // 重置全部状态
  const reset = useCallback(() => {
    setMatchState("idle");
    setPeer(null);
    setMatchId(null);
    setIsInitiator(false);
    setQueueSize(0);
    setEstimatedWait(0);
    setRemainingMatchSeconds(0);
    setTimeLimit(0);
    setUnlimited(false);
    setMyLiked(false);
    setPeerLiked(false);
    setTextMessages([]);
    setLevelUpInfo(null);
    setLastExperienceGained(0);
  }, []);

  // ============================================
  // 返回
  // ============================================
  return {
    // 状态
    matchState,
    currentUser,
    peer,
    matchId,
    isInitiator,
    isConnected,

    // 匹配队列
    queueSize,
    estimatedWait,
    remainingMatchSeconds,
    onlineCount,

    // 通话限时 & 互赞
    timeLimit,
    unlimited,
    myLiked,
    peerLiked,

    // 文字聊天
    textMessages,

    // 评分/经验
    lastExperienceGained,
    levelUpInfo,

    // 操作
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
  };
}
