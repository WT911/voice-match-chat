/**
 * 用户存储 - 增强版 (含陪我全部功能)
 */

import { v4 as uuidv4 } from "uuid";
import type { VoiceMatchUser, UserStats, CallRecord } from "./voice-match-types.js";
import { levelSystem } from "./level-system.js";
import type { WSClient } from "./types.js";

export class UserStore {
  private users: Map<string, VoiceMatchUser> = new Map();
  private wsUserMap: Map<WSClient, string> = new Map();
  /** 通话记录: userId -> CallRecord[] */
  private callRecords: Map<string, CallRecord[]> = new Map();

  register(
    wsClient: WSClient,
    gender: "male" | "female",
    nickname: string,
    tags: string[],
    zodiac: string,
    voiceIntro: string = "",
    avatarId: number = Math.floor(Math.random() * 20) + 1,
  ): VoiceMatchUser {
    const userId = uuidv4();
    const now = new Date().toISOString();

    const user: VoiceMatchUser = {
      userId,
      gender,
      nickname,
      tags,
      zodiac,
      voiceIntro,
      avatarId,
      level: 0,
      experience: 0,
      stats: {
        totalMatches: 0,
        totalCallDuration: 0,
        totalRatings: 0,
        totalRatingScore: 0,
        currentStreak: 0,
        lastMatchDate: "",
        createdAt: now,
      },
      pricePerMinute: 0,
      totalEarnings: 0,
      blacklist: [],
      connectedAt: Date.now(),
      wsClient,
    };

    this.users.set(userId, user);
    this.wsUserMap.set(wsClient, userId);
    this.callRecords.set(userId, []);
    return user;
  }

  getUser(userId: string): VoiceMatchUser | undefined {
    return this.users.get(userId);
  }

  getUserByWS(ws: WSClient): VoiceMatchUser | undefined {
    const userId = this.wsUserMap.get(ws);
    if (!userId) return undefined;
    return this.users.get(userId);
  }

  removeUser(userId: string): void {
    const user = this.users.get(userId);
    if (user) {
      this.wsUserMap.delete(user.wsClient);
      this.users.delete(userId);
    }
  }

  removeByWS(ws: WSClient): void {
    const userId = this.wsUserMap.get(ws);
    if (userId) {
      this.users.delete(userId);
      this.wsUserMap.delete(ws);
    }
  }

  /** 更新用户资料 */
  updateProfile(userId: string, updates: { pricePerMinute?: number; preferredZodiacs?: string[]; tags?: string[] }): void {
    const user = this.users.get(userId);
    if (!user) return;
    if (updates.pricePerMinute !== undefined) user.pricePerMinute = updates.pricePerMinute;
  }

  updateStats(userId: string, updates: Partial<UserStats>): void {
    const user = this.users.get(userId);
    if (!user) return;
    Object.assign(user.stats, updates);
  }

  /** 添加通话记录 */
  addCallRecord(userId: string, record: CallRecord): void {
    const records = this.callRecords.get(userId) || [];
    records.unshift(record);
    if (records.length > 50) records.length = 50;
    this.callRecords.set(userId, records);
  }

  getCallRecords(userId: string): CallRecord[] {
    return this.callRecords.get(userId) || [];
  }

  /** 黑名单操作 */
  blockUser(userId: string, targetId: string): void {
    const user = this.users.get(userId);
    if (user && !user.blacklist.includes(targetId)) {
      user.blacklist.push(targetId);
    }
  }

  isBlocked(userId: string, targetId: string): boolean {
    const user = this.users.get(userId);
    return user ? user.blacklist.includes(targetId) : false;
  }

  /** 增加收益 */
  addEarnings(userId: string, amount: number): void {
    const user = this.users.get(userId);
    if (user) user.totalEarnings += amount;
  }

  /** 增加经验值 */
  addExperience(
    userId: string,
    amount: number
  ): { previousLevel: number; newLevel: number; experience: number; leveledUp: boolean } | null {
    const user = this.users.get(userId);
    if (!user) return null;
    const oldXP = user.experience;
    user.experience += amount;
    const result = levelSystem.checkLevelUp(oldXP, user.experience);
    if (result) {
      user.level = result.newLevel;
      return { previousLevel: result.previousLevel, newLevel: result.newLevel, experience: user.experience, leveledUp: true };
    }
    return { previousLevel: user.level, newLevel: user.level, experience: user.experience, leveledUp: false };
  }

  getUserCount(): number { return this.users.size; }

  /** 获取在线人数 (按性别) */
  getOnlineCount(): { male: number; female: number } {
    let male = 0, female = 0;
    for (const user of this.users.values()) {
      if (user.wsClient.readyState === 1) {
        if (user.gender === "male") male++; else female++;
      }
    }
    return { male, female };
  }

  /** 获取所有在线用户的标签分布 (用于推荐) */
  getTagDistribution(): Map<string, number> {
    const dist = new Map<string, number>();
    for (const user of this.users.values()) {
      if (user.wsClient.readyState === 1) {
        for (const tag of user.tags) {
          dist.set(tag, (dist.get(tag) || 0) + 1);
        }
      }
    }
    return dist;
  }
}

export const userStore = new UserStore();
