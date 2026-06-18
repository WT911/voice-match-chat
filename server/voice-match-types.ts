// ============================================
// 语音匹配功能 - 完整类型定义 (含「陪我」全功能)
// ============================================

import type { WSClient } from "./types.js";

// ============================================
// 用户模型 (增强版: +标签 +星座 +声音名片 +付费 +黑名单)
// ============================================

export interface VoiceMatchUser {
  userId: string;
  gender: "male" | "female";
  nickname: string;
  /** 用户标签 (兴趣/性格) */
  tags: string[];
  /** 星座 */
  zodiac: string;
  /** 声音名片 URL (base64 录音) */
  voiceIntro: string;
  /** 匿名头像编号 (1-20 预设动物头像) */
  avatarId: number;
  level: number;
  experience: number;
  stats: UserStats;
  /** 付费设置: 每分钟价格 (0=免费) */
  pricePerMinute: number;
  /** 总收入 (分) */
  totalEarnings: number;
  /** 黑名单 userId 列表 */
  blacklist: string[];
  connectedAt: number;
  wsClient: WSClient;
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

// ============================================
// 等级系统
// ============================================

export interface LevelConfig {
  level: number;
  name: string;
  requiredXP: number;
  benefits: LevelBenefit[];
  icon: string;
  color: string;
}

export interface LevelBenefit {
  id: string;
  name: string;
  description: string;
  type: "cosmetic" | "functional" | "privilege";
}

// ============================================
// 匹配系统 (增强: +标签匹配 +星座筛选 +通话限时)
// ============================================

export interface MatchRequest {
  userId: string;
  gender: "male" | "female";
  level: number;
  tags: string[];
  zodiac: string;
  /** 偏好星座筛选 (空=不限) */
  preferredZodiacs: string[];
  joinedAt: number;
}

export interface MatchResult {
  matchId: string;
  user1: VoiceMatchUser;
  user2: VoiceMatchUser;
  matchedAt: number;
}

export interface MatchSession {
  matchId: string;
  user1: VoiceMatchUser;
  user2: VoiceMatchUser;
  startedAt: number;
  status: "pending" | "active" | "ended";
  ratings: Map<string, Rating>;
  /** 通话限时秒数 (3分钟=180秒) */
  timeLimit: number;
  /** 是否已解锁无限时 (互赞后) */
  unlimited: boolean;
  /** 双方点赞状态 */
  likes: Map<string, boolean>;
  /** 文字聊天消息 */
  textMessages: TextMessage[];
}

export interface TextMessage {
  id: string;
  senderId: string;
  content: string;
  timestamp: string;
}

// ============================================
// 评分系统
// ============================================

export interface Rating {
  matchId: string;
  raterId: string;
  targetId: string;
  score: 1 | 2 | 3 | 4 | 5;
  tags: string[];
  comment: string;
  createdAt: string;
}

// ============================================
// 通话记录
// ============================================

export interface CallRecord {
  matchId: string;
  peerId: string;
  peerNickname: string;
  peerGender: "male" | "female";
  peerAvatarId: number;
  peerLevel: number;
  callDuration: number;      // 秒
  startedAt: string;
  myRating?: number;
  unlimited: boolean;
}

// ============================================
// 兴趣标签库
// ============================================

export const INTEREST_TAGS = [
  "音乐", "电影", "旅行", "美食", "运动", "游戏",
  "读书", "摄影", "宠物", "动漫", "科技", "时尚",
  "健身", "画画", "跳舞", "唱歌", "写作", "编程",
  "咖啡", "茶艺", "露营", "滑雪", "潜水", "瑜伽",
];

export const ZODIAC_SIGNS = [
  "白羊座", "金牛座", "双子座", "巨蟹座",
  "狮子座", "处女座", "天秤座", "天蝎座",
  "射手座", "摩羯座", "水瓶座", "双鱼座",
];

// ============================================
// WebSocket 消息类型 (客户端 -> 服务端) - 扩展
// ============================================

export type VoiceMatchIncomingMessage =
  | VMRegisterMessage
  | VMUpdateProfileMessage
  | VMStartMatchMessage
  | VMCancelMatchMessage
  | VMSignalMessage
  | VMEndCallMessage
  | VMSendLikeMessage
  | VMSendTextMessage
  | VMSubmitRatingMessage;

export interface VMRegisterMessage {
  type: "voice_match:register";
  gender: "male" | "female";
  nickname: string;
  tags: string[];
  zodiac: string;
  voiceIntro?: string;
  avatarId?: number;
}

export interface VMUpdateProfileMessage {
  type: "voice_match:update_profile";
  pricePerMinute?: number;
  preferredZodiacs?: string[];
  tags?: string[];
}

export interface VMStartMatchMessage {
  type: "voice_match:start";
}

export interface VMCancelMatchMessage {
  type: "voice_match:cancel";
}

export interface VMSignalMessage {
  type: "voice_match:signal";
  matchId: string;
  signalType: "offer" | "answer" | "ice_candidate";
  sdp?: any;
  candidate?: any;
}

export interface VMEndCallMessage {
  type: "voice_match:end_call";
  matchId: string;
}

export interface VMSendLikeMessage {
  type: "voice_match:send_like";
  matchId: string;
}

export interface VMSendTextMessage {
  type: "voice_match:text_message";
  matchId: string;
  content: string;
}

export interface VMSubmitRatingMessage {
  type: "voice_match:rate";
  matchId: string;
  score: 1 | 2 | 3 | 4 | 5;
  tags: string[];
  comment?: string;
}

// ============================================
// WebSocket 消息类型 (服务端 -> 客户端) - 扩展
// ============================================

export type VoiceMatchOutgoingMessage =
  | VMRegisteredMessage
  | VMMatchingMessage
  | VMMatchFoundMessage
  | VMMatchTimeoutMessage
  | VMSignalForwardMessage
  | VMPeerDisconnectedMessage
  | VMLevelUpdateMessage
  | VMRatingConfirmedMessage
  | VMStatsUpdateMessage
  | VMTimeWarningMessage
  | VMUnlimitedMessage
  | VMLikeReceivedMessage
  | VMTextMessageReceived
  | VMOnlineCountMessage
  | VMBlockedMessage
  | VMCallRecordMessage;

export interface VMRegisteredMessage {
  type: "voice_match:registered";
  userId: string;
  nickname: string;
  gender: "male" | "female";
  tags: string[];
  zodiac: string;
  voiceIntro: string;
  avatarId: number;
  level: number;
  experience: number;
  stats: UserStats;
  pricePerMinute: number;
  callRecords: CallRecord[];
}

export interface VMMatchingMessage {
  type: "voice_match:matching";
  queueSize: number;
  estimatedWait: number;
  remainingSeconds: number;
  onlineCount: number;
}

export interface VMMatchFoundMessage {
  type: "voice_match:match_found";
  matchId: string;
  peer: {
    userId: string;
    nickname: string;
    level: number;
    gender: "male" | "female";
    tags: string[];
    zodiac: string;
    avatarId: number;
    voiceIntro: string;
    pricePerMinute: number;
  };
  initiator: boolean;
  timeLimit: number;
}

export interface VMMatchTimeoutMessage {
  type: "voice_match:match_timeout";
  reason: string;
}

export interface VMSignalForwardMessage {
  type: "voice_match:signal_forward";
  matchId: string;
  signalType: "offer" | "answer" | "ice_candidate";
  sdp?: any;
  candidate?: any;
}

export interface VMPeerDisconnectedMessage {
  type: "voice_match:peer_disconnected";
  matchId: string;
  reason: string;
  callDuration: number;
}

export interface VMLevelUpdateMessage {
  type: "voice_match:level_update";
  previousLevel: number;
  newLevel: number;
  experience: number;
  experienceGained: number;
}

export interface VMRatingConfirmedMessage {
  type: "voice_match:rating_confirmed";
  matchId: string;
  experienceGained: number;
}

export interface VMStatsUpdateMessage {
  type: "voice_match:stats_update";
  stats: UserStats;
  level: number;
  experience: number;
  callRecords: CallRecord[];
}

export interface VMTimeWarningMessage {
  type: "voice_match:time_warning";
  matchId: string;
  remainingSeconds: number;
  /** 时间到自动挂断 */
  expired: boolean;
}

export interface VMUnlimitedMessage {
  type: "voice_match:unlimited";
  matchId: string;
}

export interface VMLikeReceivedMessage {
  type: "voice_match:like_received";
  matchId: string;
  fromUserId: string;
  mutual: boolean;
}

export interface VMTextMessageReceived {
  type: "voice_match:text_message";
  matchId: string;
  messageId: string;
  senderId: string;
  content: string;
  timestamp: string;
}

export interface VMOnlineCountMessage {
  type: "voice_match:online_count";
  male: number;
  female: number;
}

export interface VMBlockedMessage {
  type: "voice_match:blocked";
  targetId: string;
}

export interface VMCallRecordMessage {
  type: "voice_match:call_records";
  records: CallRecord[];
}
