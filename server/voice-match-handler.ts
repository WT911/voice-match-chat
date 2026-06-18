/**
 * 语音匹配 WebSocket 消息处理器 - 增强版 (陪我全功能)
 */

import type { WSClient } from "./types.js";
import type { VoiceMatchIncomingMessage } from "./voice-match-types.js";
import { userStore } from "./user-store.js";
import { matchQueue } from "./matching.js";
import { signalingManager } from "./webrtc-signaling.js";
import { levelSystem } from "./level-system.js";
import { config } from "./config.js";
import { userRepo } from "./db/index.js";

export async function handleVoiceMatchMessage(
  ws: WSClient,
  message: VoiceMatchIncomingMessage
): Promise<void> {
  const send = (data: object) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(data));
  };

  switch (message.type) {
    // ==========================================
    // 注册 (增强版: 标签+星座+声音名片+头像)
    // ==========================================
    case "voice_match:register": {
      const existing = userStore.getUserByWS(ws);
      if (existing) {
        send({
          type: "voice_match:registered",
          userId: existing.userId,
          nickname: existing.nickname,
          gender: existing.gender,
          tags: existing.tags,
          zodiac: existing.zodiac,
          voiceIntro: existing.voiceIntro,
          avatarId: existing.avatarId,
          level: existing.level,
          experience: existing.experience,
          stats: existing.stats,
          pricePerMinute: existing.pricePerMinute,
          callRecords: userStore.getCallRecords(existing.userId),
        });
        return;
      }

      const user = userStore.register(
        ws,
        message.gender,
        message.nickname,
        message.tags || [],
        message.zodiac || "",
        message.voiceIntro || "",
        message.avatarId || Math.floor(Math.random() * 20) + 1,
      );

      send({
        type: "voice_match:registered",
        userId: user.userId,
        nickname: user.nickname,
        gender: user.gender,
        tags: user.tags,
        zodiac: user.zodiac,
        voiceIntro: user.voiceIntro,
        avatarId: user.avatarId,
        level: user.level,
        experience: user.experience,
        stats: user.stats,
        pricePerMinute: user.pricePerMinute,
        callRecords: [],
      });

      // 广播在线人数
      broadcastOnlineCount();
      break;
    }

    // ==========================================
    // 更新资料 (付费设置/偏好星座)
    // ==========================================
    case "voice_match:update_profile": {
      const user = userStore.getUserByWS(ws);
      if (!user) return;
      userStore.updateProfile(user.userId, {
        pricePerMinute: message.pricePerMinute,
      });
      send({
        type: "voice_match:stats_update",
        stats: user.stats,
        level: user.level,
        experience: user.experience,
        callRecords: userStore.getCallRecords(user.userId),
      });
      break;
    }

    // ==========================================
    // 开始匹配
    // ==========================================
    case "voice_match:start": {
      const user = userStore.getUserByWS(ws);
      if (!user) {
        send({ type: "voice_match:match_timeout", reason: "请先注册" });
        return;
      }

      // 从消息中获取偏好星座 (如果有)
      const preferredZodiacs: string[] = (message as any).preferredZodiacs || [];
      matchQueue.joinQueue(user, preferredZodiacs);

      const status = matchQueue.getQueueStatus(user.gender);
      const onlineCount = userStore.getOnlineCount();
      send({
        type: "voice_match:matching",
        queueSize: status.queueSize,
        estimatedWait: status.estimatedWait,
        remainingSeconds: status.remainingSeconds,
        onlineCount: onlineCount.male + onlineCount.female,
      });
      break;
    }

    // ==========================================
    // 取消匹配
    // ==========================================
    case "voice_match:cancel": {
      const user = userStore.getUserByWS(ws);
      if (user) matchQueue.leaveQueue(user.userId);
      break;
    }

    // ==========================================
    // WebRTC 信令转发
    // ==========================================
    case "voice_match:signal": {
      const user = userStore.getUserByWS(ws);
      if (!user) return;
      signalingManager.forwardSignal(
        message.matchId, user.userId, message.signalType, message.sdp, message.candidate
      );
      break;
    }

    // ==========================================
    // 发送点赞 (互赞解锁无限时)
    // ==========================================
    case "voice_match:send_like": {
      const user = userStore.getUserByWS(ws);
      if (!user) return;

      const { mutual } = matchQueue.sendLike(message.matchId, user.userId);
      const peerId = matchQueue.getPeerId(message.matchId, user.userId);

      // 通知对方
      if (peerId) {
        signalingManager.sendToUser(peerId, {
          type: "voice_match:like_received",
          matchId: message.matchId,
          fromUserId: user.userId,
          mutual,
        });
      }

      // 通知自己
      send({
        type: "voice_match:like_received",
        matchId: message.matchId,
        fromUserId: user.userId,
        mutual,
      });
      break;
    }

    // ==========================================
    // 发送文字消息 (通话中)
    // ==========================================
    case "voice_match:text_message": {
      const user = userStore.getUserByWS(ws);
      if (!user) return;

      const msgId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const now = new Date().toISOString();

      matchQueue.addTextMessage(message.matchId, {
        id: msgId,
        senderId: user.userId,
        content: message.content,
        timestamp: now,
      });

      const peerId = matchQueue.getPeerId(message.matchId, user.userId);
      const textMsg = {
        type: "voice_match:text_message" as const,
        matchId: message.matchId,
        messageId: msgId,
        senderId: user.userId,
        content: message.content,
        timestamp: now,
      };

      // 发给对方
      if (peerId) signalingManager.sendToUser(peerId, textMsg);
      // 发给自己 (确认)
      send(textMsg);
      break;
    }

    // ==========================================
    // 结束通话
    // ==========================================
    case "voice_match:end_call": {
      const user = userStore.getUserByWS(ws);
      if (!user) return;

      const session = matchQueue.getSession(message.matchId);
      if (!session) return;

      const callDuration = Math.floor((Date.now() - session.startedAt) / 1000);

      // 更新双方统计和通话记录
      const peerId = matchQueue.getPeerId(message.matchId, user.userId);
      const peer = peerId ? userStore.getUser(peerId) : null;

      userStore.updateStats(user.userId, {
        totalCallDuration: user.stats.totalCallDuration + callDuration,
      });
      userStore.addCallRecord(user.userId, {
        matchId: message.matchId,
        peerId: peerId || "",
        peerNickname: peer?.nickname || "",
        peerGender: peer?.gender || "male",
        peerAvatarId: peer?.avatarId || 1,
        peerLevel: peer?.level || 0,
        callDuration,
        startedAt: new Date(session.startedAt).toISOString(),
        unlimited: session.unlimited,
      });

      // 同步写入数据库
      if (process.env.DATABASE_URL) {
        userRepo.updateStats(user.userId, {
          totalCallDuration: user.stats.totalCallDuration + callDuration,
        }).catch(() => {});
        userRepo.addCallRecord(user.userId, {
          matchId: message.matchId,
          peerId: peerId || "",
          peerNickname: peer?.nickname || "",
          peerGender: peer?.gender || "male",
          peerAvatarId: peer?.avatarId || 1,
          peerLevel: peer?.level || 0,
          callDuration,
          startedAt: new Date(session.startedAt).toISOString(),
          unlimited: session.unlimited,
        }).catch(() => {});
      }

      if (peer) {
        userStore.updateStats(peerId!, {
          totalCallDuration: peer.stats.totalCallDuration + callDuration,
        });
        userStore.addCallRecord(peerId!, {
          matchId: message.matchId,
          peerId: user.userId,
          peerNickname: user.nickname,
          peerGender: user.gender,
          peerAvatarId: user.avatarId,
          peerLevel: user.level,
          callDuration,
          startedAt: new Date(session.startedAt).toISOString(),
          unlimited: session.unlimited,
        });

        // 计算付费收益
        if (peer.pricePerMinute > 0) {
          const minutes = Math.ceil(callDuration / 60);
          const earnings = minutes * peer.pricePerMinute;
          userStore.addEarnings(peerId!, earnings);
        }

        // 同步写入数据库
        if (process.env.DATABASE_URL) {
          userRepo.updateStats(peerId!, {
            totalCallDuration: peer!.stats.totalCallDuration + callDuration,
          }).catch(() => {});
          userRepo.addCallRecord(peerId!, {
            matchId: message.matchId,
            peerId: user.userId,
            peerNickname: user.nickname,
            peerGender: user.gender,
            peerAvatarId: user.avatarId,
            peerLevel: user.level,
            callDuration,
            startedAt: new Date(session.startedAt).toISOString(),
            unlimited: session.unlimited,
          }).catch(() => {});
          if (peer!.pricePerMinute > 0) {
            const minutes = Math.ceil(callDuration / 60);
            const earnings = minutes * peer!.pricePerMinute;
            userRepo.addEarnings(peerId!, earnings).catch(() => {});
          }
        }
      }

      matchQueue.endSession(message.matchId);

      // 通知双方
      signalingManager.notifyPeerDisconnected(message.matchId, user.userId, "对方已挂断");

      send({
        type: "voice_match:peer_disconnected",
        matchId: message.matchId,
        reason: "通话结束，请评分",
        callDuration,
      });
      break;
    }

    // ==========================================
    // 提交评分
    // ==========================================
    case "voice_match:rate": {
      const user = userStore.getUserByWS(ws);
      if (!user) return;

      const session = matchQueue.getSession(message.matchId);
      if (!session) return;

      const peerId = matchQueue.getPeerId(message.matchId, user.userId);
      if (!peerId) return;

      matchQueue.addRating(message.matchId, {
        matchId: message.matchId,
        raterId: user.userId,
        targetId: peerId,
        score: message.score,
        tags: message.tags,
        comment: message.comment || "",
        createdAt: new Date().toISOString(),
      });

      userStore.updateStats(peerId, {
        totalRatings: (userStore.getUser(peerId)?.stats.totalRatings || 0) + 1,
        totalRatingScore: (userStore.getUser(peerId)?.stats.totalRatingScore || 0) + message.score,
      });

      const callDuration = Math.floor((Date.now() - session.startedAt) / 1000);
      const today = new Date().toISOString().split("T")[0];
      const isFirstMatchToday = user.stats.lastMatchDate !== today;
      const xpGained = levelSystem.calculateCallExperience(callDuration, message.score, isFirstMatchToday, user.stats.currentStreak);
      const result = userStore.addExperience(user.userId, xpGained);

      send({ type: "voice_match:rating_confirmed", matchId: message.matchId, experienceGained: xpGained });

      const updatedUser = userStore.getUser(user.userId);
      if (updatedUser) {
        send({
          type: "voice_match:stats_update",
          stats: updatedUser.stats, level: updatedUser.level, experience: updatedUser.experience,
          callRecords: userStore.getCallRecords(user.userId),
        });
      }

      if (result?.leveledUp) {
        send({ type: "voice_match:level_update", previousLevel: result.previousLevel, newLevel: result.newLevel, experience: result.experience, experienceGained: xpGained });
      }

      // 双方评分后处理对方经验值
      if (matchQueue.bothRated(message.matchId)) {
        const peerUser = userStore.getUser(peerId);
        if (peerUser) {
          const peerFirstMatch = peerUser.stats.lastMatchDate !== today;
          const peerXP = levelSystem.calculateCallExperience(callDuration, message.score >= 3 ? message.score : 3, peerFirstMatch, peerUser.stats.currentStreak);
          const peerResult = userStore.addExperience(peerId, peerXP);

          signalingManager.sendToUser(peerId, { type: "voice_match:rating_confirmed", matchId: message.matchId, experienceGained: peerXP });

          const updatedPeer = userStore.getUser(peerId);
          if (updatedPeer) {
            signalingManager.sendToUser(peerId, {
              type: "voice_match:stats_update",
              stats: updatedPeer.stats, level: updatedPeer.level, experience: updatedPeer.experience,
              callRecords: userStore.getCallRecords(peerId),
            });
          }

          if (peerResult?.leveledUp) {
            signalingManager.sendToUser(peerId, { type: "voice_match:level_update", previousLevel: peerResult.previousLevel, newLevel: peerResult.newLevel, experience: peerResult.experience, experienceGained: peerXP });
          }
        }
      }
      break;
    }
  }
}

/** 广播在线人数 */
function broadcastOnlineCount(): void {
  const count = userStore.getOnlineCount();
  // 通过 signalingManager 广播给所有在线用户
  // 实际生产环境可以用 Redis pub/sub
}

/** 匹配成功通知 */
export function notifyMatchFound(matchId: string, user1Id: string, user2Id: string): void {
  const user1 = userStore.getUser(user1Id);
  const user2 = userStore.getUser(user2Id);
  if (!user1 || !user2) return;

  const session = matchQueue.getSession(matchId);

  const peer1 = {
    userId: user2.userId, nickname: user2.nickname, level: user2.level,
    gender: user2.gender, tags: user2.tags, zodiac: user2.zodiac,
    avatarId: user2.avatarId, voiceIntro: user2.voiceIntro, pricePerMinute: user2.pricePerMinute,
  };
  const peer2 = {
    userId: user1.userId, nickname: user1.nickname, level: user1.level,
    gender: user1.gender, tags: user1.tags, zodiac: user1.zodiac,
    avatarId: user1.avatarId, voiceIntro: user1.voiceIntro, pricePerMinute: user1.pricePerMinute,
  };

  signalingManager.sendToUser(user1Id, {
    type: "voice_match:match_found", matchId, peer: peer1, initiator: true,
    timeLimit: session?.timeLimit || config.voiceMatch.callTimeLimit,
  });
  signalingManager.sendToUser(user2Id, {
    type: "voice_match:match_found", matchId, peer: peer2, initiator: false,
    timeLimit: session?.timeLimit || config.voiceMatch.callTimeLimit,
  });

  matchQueue.activateSession(matchId);
}

/** 时间警告回调 */
export function setupMatchCallbacks(): void {
  matchQueue.setOnTimeWarning((matchId, remaining, expired) => {
    const session = matchQueue.getSession(matchId);
    if (!session) return;

    const msg = { type: "voice_match:time_warning", matchId, remainingSeconds: remaining, expired };
    signalingManager.sendToUser(session.user1.userId, msg);
    signalingManager.sendToUser(session.user2.userId, msg);

    // 时间到自动挂断
    if (expired) {
      signalingManager.sendToUser(session.user1.userId, {
        type: "voice_match:peer_disconnected", matchId, reason: "通话时间到", callDuration: session.timeLimit,
      });
      signalingManager.sendToUser(session.user2.userId, {
        type: "voice_match:peer_disconnected", matchId, reason: "通话时间到", callDuration: session.timeLimit,
      });
      matchQueue.endSession(matchId);
    }
  });

  matchQueue.setOnUnlimited((matchId) => {
    const session = matchQueue.getSession(matchId);
    if (!session) return;
    const msg = { type: "voice_match:unlimited", matchId };
    signalingManager.sendToUser(session.user1.userId, msg);
    signalingManager.sendToUser(session.user2.userId, msg);
  });
}
