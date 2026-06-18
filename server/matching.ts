/**
 * 匹配队列管理 - 增强版 (标签匹配 + 星座筛选 + 黑名单 + 通话限时 + 互赞)
 */

import { v4 as uuidv4 } from "uuid";
import type { VoiceMatchUser, MatchRequest, MatchResult, MatchSession, Rating, CallRecord, TextMessage } from "./voice-match-types.js";
import { userStore } from "./user-store.js";
import { config } from "./config.js";

export class MatchQueue {
  private maleQueue: MatchRequest[] = [];
  private femaleQueue: MatchRequest[] = [];
  private activeSessions: Map<string, MatchSession> = new Map();
  /** 通话限时定时器 */
  private timeLimitTimers: Map<string, NodeJS.Timeout> = new Map();
  private onMatchCallback: ((matchId: string, userId1: string, userId2: string) => void) | null = null;
  private onTimeWarningCallback: ((matchId: string, remaining: number, expired: boolean) => void) | null = null;
  private onUnlimitedCallback: ((matchId: string) => void) | null = null;

  setOnMatch(callback: (matchId: string, userId1: string, userId2: string) => void): void {
    this.onMatchCallback = callback;
  }

  setOnTimeWarning(callback: (matchId: string, remaining: number, expired: boolean) => void): void {
    this.onTimeWarningCallback = callback;
  }

  setOnUnlimited(callback: (matchId: string) => void): void {
    this.onUnlimitedCallback = callback;
  }

  /** 加入匹配队列 */
  joinQueue(user: VoiceMatchUser, preferredZodiacs: string[] = []): void {
    this.leaveQueue(user.userId);

    const request: MatchRequest = {
      userId: user.userId,
      gender: user.gender,
      level: user.level,
      tags: user.tags,
      zodiac: user.zodiac,
      preferredZodiacs,
      joinedAt: Date.now(),
    };

    if (user.gender === "male") {
      this.maleQueue.push(request);
    } else {
      this.femaleQueue.push(request);
    }

    console.log(`[MatchQueue] ${user.nickname}(${user.gender}) joined. M:${this.maleQueue.length} F:${this.femaleQueue.length}`);
    this.tryMatch();
  }

  /** 离开匹配队列 */
  leaveQueue(userId: string): void {
    this.maleQueue = this.maleQueue.filter((r) => r.userId !== userId);
    this.femaleQueue = this.femaleQueue.filter((r) => r.userId !== userId);
  }

  /**
   * 尝试匹配 - 增强匹配算法
   * 1. 黑名单过滤
   * 2. 标签匹配度评分
   * 3. 星座偏好筛选
   * 4. 等级相近优先
   */
  private tryMatch(): MatchResult | null {
    this.cleanupTimeoutRequests();

    if (this.maleQueue.length === 0 || this.femaleQueue.length === 0) return null;

    // 按标签匹配度+等级排序
    const scoredPairs: { mi: number; fi: number; score: number }[] = [];

    for (let mi = 0; mi < this.maleQueue.length; mi++) {
      const male = this.maleQueue[mi];
      const maleUser = userStore.getUser(male.userId);
      if (!maleUser) continue;

      for (let fi = 0; fi < this.femaleQueue.length; fi++) {
        const female = this.femaleQueue[fi];
        const femaleUser = userStore.getUser(female.userId);
        if (!femaleUser) continue;

        // 黑名单过滤
        if (maleUser.blacklist.includes(female.userId) || femaleUser.blacklist.includes(male.userId)) continue;

        // 星座筛选
        if (male.preferredZodiacs.length > 0 && !male.preferredZodiacs.includes(female.zodiac)) continue;
        if (female.preferredZodiacs.length > 0 && !female.preferredZodiacs.includes(male.zodiac)) continue;

        // 计算匹配得分
        let score = 0;
        // 标签匹配度 (共同标签数)
        const commonTags = male.tags.filter(t => female.tags.includes(t));
        score += commonTags.length * 10;
        // 等级相近度 (差越小分越高)
        score += Math.max(0, 20 - Math.abs(male.level - female.level) * 5);
        // 等待时间补偿 (每秒+1分)
        score += Math.floor((Date.now() - male.joinedAt) / 1000);
        score += Math.floor((Date.now() - female.joinedAt) / 1000);

        scoredPairs.push({ mi, fi, score });
      }
    }

    if (scoredPairs.length === 0) return null;

    // 按得分降序排列
    scoredPairs.sort((a, b) => b.score - a.score);

    const best = scoredPairs[0];
    const male = this.maleQueue[best.mi];
    const female = this.femaleQueue[best.fi];

    this.maleQueue.splice(best.mi, 1);
    this.femaleQueue.splice(best.fi, 1);

    return this.createMatch(male.userId, female.userId);
  }

  private createMatch(maleId: string, femaleId: string): MatchResult | null {
    const maleUser = userStore.getUser(maleId);
    const femaleUser = userStore.getUser(femaleId);
    if (!maleUser || !femaleUser) return null;

    const matchId = uuidv4();
    const today = new Date().toISOString().split("T")[0];

    userStore.updateStats(maleId, { totalMatches: maleUser.stats.totalMatches + 1, lastMatchDate: today });
    userStore.updateStats(femaleId, { totalMatches: femaleUser.stats.totalMatches + 1, lastMatchDate: today });
    this.updateStreak(maleId, today);
    this.updateStreak(femaleId, today);

    const session: MatchSession = {
      matchId,
      user1: maleUser,
      user2: femaleUser,
      startedAt: Date.now(),
      status: "pending",
      ratings: new Map(),
      timeLimit: config.voiceMatch.callTimeLimit,
      unlimited: false,
      likes: new Map(),
      textMessages: [],
    };
    this.activeSessions.set(matchId, session);

    console.log(`[MatchQueue] Match: ${maleUser.nickname}(Lv${maleUser.level}) <-> ${femaleUser.nickname}(Lv${femaleUser.level}), tags:${maleUser.tags.filter(t=>femaleUser.tags.includes(t)).length}`);

    if (this.onMatchCallback) {
      this.onMatchCallback(matchId, maleId, femaleId);
    }

    return { matchId, user1: maleUser, user2: femaleUser, matchedAt: Date.now() };
  }

  /** 激活会话并启动限时定时器 */
  activateSession(matchId: string): void {
    const session = this.activeSessions.get(matchId);
    if (!session) return;
    session.status = "active";
    session.startedAt = Date.now();

    // 启动倒计时提醒 (最后60秒每10秒提醒一次)
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - session.startedAt) / 1000);
      const remaining = session.timeLimit - elapsed;
      if (remaining <= 60 && remaining > 0 && remaining % 10 === 0) {
        this.onTimeWarningCallback?.(matchId, remaining, false);
      }
      if (remaining <= 0 && !session.unlimited) {
        this.onTimeWarningCallback?.(matchId, 0, true);
        clearInterval(timer);
        this.timeLimitTimers.delete(matchId);
      }
    }, 1000);
    this.timeLimitTimers.set(matchId, timer);
  }

  /** 发送点赞 */
  sendLike(matchId: string, userId: string): { mutual: boolean } {
    const session = this.activeSessions.get(matchId);
    if (!session) return { mutual: false };

    session.likes.set(userId, true);

    // 检查双方是否都点赞了
    const user1Liked = session.likes.get(session.user1.userId) || false;
    const user2Liked = session.likes.get(session.user2.userId) || false;
    const mutual = user1Liked && user2Liked;

    if (mutual && !session.unlimited) {
      session.unlimited = true;
      // 清除限时定时器
      const timer = this.timeLimitTimers.get(matchId);
      if (timer) {
        clearInterval(timer);
        this.timeLimitTimers.delete(matchId);
      }
      this.onUnlimitedCallback?.(matchId);
    }

    return { mutual };
  }

  /** 添加文字消息 */
  addTextMessage(matchId: string, message: TextMessage): void {
    const session = this.activeSessions.get(matchId);
    if (session) {
      session.textMessages.push(message);
    }
  }

  /** 获取活跃会话 */
  getSession(matchId: string): MatchSession | undefined {
    return this.activeSessions.get(matchId);
  }

  /** 结束会话 */
  endSession(matchId: string): void {
    const timer = this.timeLimitTimers.get(matchId);
    if (timer) { clearInterval(timer); this.timeLimitTimers.delete(matchId); }
    const session = this.activeSessions.get(matchId);
    if (session) session.status = "ended";
  }

  /** 获取对端 userId */
  getPeerId(matchId: string, currentUserId: string): string | undefined {
    const session = this.activeSessions.get(matchId);
    if (!session) return undefined;
    if (session.user1.userId === currentUserId) return session.user2.userId;
    if (session.user2.userId === currentUserId) return session.user1.userId;
    return undefined;
  }

  addRating(matchId: string, rating: Rating): void {
    const session = this.activeSessions.get(matchId);
    if (session) session.ratings.set(rating.raterId, rating);
  }

  bothRated(matchId: string): boolean {
    const session = this.activeSessions.get(matchId);
    return session ? session.ratings.size >= 2 : false;
  }

  /** 获取队列状态 */
  getQueueStatus(gender: "male" | "female"): { queueSize: number; estimatedWait: number; remainingSeconds: number } {
    const queueSize = gender === "male" ? this.maleQueue.length : this.femaleQueue.length;
    const estimatedWait = queueSize * 5;
    const remainingSeconds = Math.max(0, config.voiceMatch.matchTimeoutMs - (this.maleQueue[0]?.joinedAt ? Date.now() - this.maleQueue[0].joinedAt : 0)) / 1000;
    return { queueSize, estimatedWait, remainingSeconds: Math.ceil(remainingSeconds) };
  }

  private updateStreak(userId: string, today: string): void {
    const user = userStore.getUser(userId);
    if (!user) return;
    const lastDate = user.stats.lastMatchDate;
    if (!lastDate) { userStore.updateStats(userId, { currentStreak: 1 }); return; }
    const diffDays = Math.floor((new Date(today).getTime() - new Date(lastDate).getTime()) / 86400000);
    if (diffDays === 1) userStore.updateStats(userId, { currentStreak: user.stats.currentStreak + 1 });
    else if (diffDays > 1) userStore.updateStats(userId, { currentStreak: 1 });
  }

  private cleanupTimeoutRequests(): void {
    const now = Date.now();
    const timeout = config.voiceMatch.matchTimeoutMs;
    this.maleQueue = this.maleQueue.filter((r) => now - r.joinedAt < timeout);
    this.femaleQueue = this.femaleQueue.filter((r) => now - r.joinedAt < timeout);
  }

  cleanupStaleSessions(): void {
    const now = Date.now();
    for (const [matchId, session] of this.activeSessions) {
      if (session.status === "ended" && now - session.startedAt > 600000) {
        this.activeSessions.delete(matchId);
      }
    }
  }
}

export const matchQueue = new MatchQueue();
