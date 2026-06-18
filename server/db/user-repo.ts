/**
 * 用户数据仓库 - PostgreSQL
 * 替代原 user-store.ts 的内存存储
 * 仅在 DATABASE_URL 环境变量存在时可用
 */

import { getPool, isDBEnabled } from "./pool.js";
import type { VoiceMatchUser, UserStats, CallRecord } from "../voice-match-types.js";

// ============================================
// 用户 CRUD
// ============================================

export interface CreateUserParams {
  wechatOpenid: string;
  wechatUnionid?: string;
  nickname: string;
  avatarUrl?: string;
  gender: "male" | "female";
  tags: string[];
  zodiac: string;
  voiceIntro?: string;
  avatarId?: number;
}

export async function createUser(params: CreateUserParams): Promise<VoiceMatchUser> {
  if (!isDBEnabled()) throw new Error("Database not available");
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO users (wechat_openid, wechat_unionid, nickname, avatar_url, gender, tags, zodiac, voice_intro, avatar_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      params.wechatOpenid,
      params.wechatUnionid || null,
      params.nickname,
      params.avatarUrl || "",
      params.gender,
      params.tags,
      params.zodiac,
      params.voiceIntro || "",
      params.avatarId || 1,
    ]
  );
  return mapRowToUser(result.rows[0]);
}

export async function getUserById(id: string): Promise<VoiceMatchUser | null> {
  const pool = getPool();
  const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return result.rows[0] ? mapRowToUser(result.rows[0]) : null;
}

export async function getUserByOpenid(openid: string): Promise<VoiceMatchUser | null> {
  const pool = getPool();
  const result = await pool.query("SELECT * FROM users WHERE wechat_openid = $1", [openid]);
  return result.rows[0] ? mapRowToUser(result.rows[0]) : null;
}

export async function updateUser(
  id: string,
  updates: {
    nickname?: string;
    avatarUrl?: string;
    tags?: string[];
    zodiac?: string;
    voiceIntro?: string;
    avatarId?: number;
    pricePerMinute?: number;
    preferredZodiacs?: string[];
  }
): Promise<VoiceMatchUser | null> {
  const pool = getPool();
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (updates.nickname !== undefined) { fields.push(`nickname = $${idx++}`); values.push(updates.nickname); }
  if (updates.avatarUrl !== undefined) { fields.push(`avatar_url = $${idx++}`); values.push(updates.avatarUrl); }
  if (updates.tags !== undefined) { fields.push(`tags = $${idx++}`); values.push(updates.tags); }
  if (updates.zodiac !== undefined) { fields.push(`zodiac = $${idx++}`); values.push(updates.zodiac); }
  if (updates.voiceIntro !== undefined) { fields.push(`voice_intro = $${idx++}`); values.push(updates.voiceIntro); }
  if (updates.avatarId !== undefined) { fields.push(`avatar_id = $${idx++}`); values.push(updates.avatarId); }
  if (updates.pricePerMinute !== undefined) { fields.push(`price_per_minute = $${idx++}`); values.push(updates.pricePerMinute); }

  if (fields.length === 0) return getUserById(id);

  values.push(id);
  const result = await pool.query(
    `UPDATE users SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] ? mapRowToUser(result.rows[0]) : null;
}

// ============================================
// 统计 & 经验值
// ============================================

export async function updateStats(
  id: string,
  stats: Partial<UserStats>
): Promise<void> {
  const pool = getPool();
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (stats.totalMatches !== undefined) { fields.push(`total_matches = $${idx++}`); values.push(stats.totalMatches); }
  if (stats.totalCallDuration !== undefined) { fields.push(`total_call_duration = $${idx++}`); values.push(stats.totalCallDuration); }
  if (stats.totalRatings !== undefined) { fields.push(`total_ratings = $${idx++}`); values.push(stats.totalRatings); }
  if (stats.totalRatingScore !== undefined) { fields.push(`total_rating_score = $${idx++}`); values.push(stats.totalRatingScore); }
  if (stats.currentStreak !== undefined) { fields.push(`current_streak = $${idx++}`); values.push(stats.currentStreak); }
  if (stats.lastMatchDate !== undefined) { fields.push(`last_match_date = $${idx++}`); values.push(stats.lastMatchDate); }

  if (fields.length === 0) return;
  values.push(id);
  await pool.query(`UPDATE users SET ${fields.join(", ")} WHERE id = $${idx}`, values);
}

export async function addExperience(
  id: string,
  amount: number
): Promise<{ previousLevel: number; newLevel: number; experience: number; leveledUp: boolean }> {
  const pool = getPool();
  // 原子操作
  const result = await pool.query(
    `UPDATE users SET experience = experience + $1 WHERE id = $2 RETURNING level, experience`,
    [amount, id]
  );
  if (!result.rows[0]) throw new Error("User not found");

  const { level, experience } = result.rows[0];
  const { levelSystem } = await import("../level-system.js");
  const levelResult = levelSystem.checkLevelUp(experience - amount, experience);

  if (levelResult) {
    await pool.query("UPDATE users SET level = $1 WHERE id = $2", [levelResult.newLevel, id]);
    return { previousLevel: levelResult.previousLevel, newLevel: levelResult.newLevel, experience, leveledUp: true };
  }
  return { previousLevel: level, newLevel: level, experience, leveledUp: false };
}

export async function addEarnings(id: string, amount: number): Promise<void> {
  const pool = getPool();
  await pool.query("UPDATE users SET total_earnings = total_earnings + $1 WHERE id = $2", [amount, id]);
}

// ============================================
// 黑名单
// ============================================

export async function blockUser(userId: string, targetId: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE users SET blacklist = array_append(blacklist, $1) WHERE id = $2 AND NOT ($1 = ANY(blacklist))`,
    [targetId, userId]
  );
}

export async function isBlocked(userId: string, targetId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    "SELECT $1 = ANY(blacklist) AS blocked FROM users WHERE id = $2",
    [targetId, userId]
  );
  return result.rows[0]?.blocked || false;
}

// ============================================
// 在线用户统计
// ============================================

export async function getOnlineCount(): Promise<{ male: number; female: number }> {
  const pool = getPool();
  const result = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE gender = 'male') AS male,
      COUNT(*) FILTER (WHERE gender = 'female') AS female
    FROM users 
    WHERE last_login_at > NOW() - INTERVAL '5 minutes'
  `);
  return { male: parseInt(result.rows[0].male), female: parseInt(result.rows[0].female) };
}

// ============================================
// 通话记录
// ============================================

export async function addCallRecord(userId: string, record: CallRecord): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO call_records (match_id, caller_id, peer_id, peer_nickname, peer_gender, peer_avatar_id, peer_level, call_duration, started_at, unlimited)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [record.matchId, userId, record.peerId, record.peerNickname, record.peerGender, record.peerAvatarId, record.peerLevel, record.callDuration, record.startedAt, record.unlimited]
  );
}

export async function updateCallRecordRating(matchId: string, userId: string, rating: number): Promise<void> {
  const pool = getPool();
  await pool.query(
    "UPDATE call_records SET my_rating = $1 WHERE match_id = $2 AND caller_id = $3",
    [rating, matchId, userId]
  );
}

export async function getCallRecords(userId: string, limit = 50): Promise<CallRecord[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT match_id, peer_id, peer_nickname, peer_gender, peer_avatar_id, peer_level, call_duration, started_at, my_rating, unlimited
     FROM call_records WHERE caller_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return result.rows.map(mapRowToCallRecord);
}

// ============================================
// 行映射
// ============================================

function mapRowToUser(row: any): VoiceMatchUser {
  return {
    userId: row.id,
    gender: row.gender,
    nickname: row.nickname,
    tags: row.tags || [],
    zodiac: row.zodiac || "",
    voiceIntro: row.voice_intro || "",
    avatarId: row.avatar_id || 1,
    level: row.level || 0,
    experience: row.experience || 0,
    pricePerMinute: row.price_per_minute || 0,
    totalEarnings: row.total_earnings || 0,
    blacklist: row.blacklist || [],
    stats: {
      totalMatches: row.total_matches || 0,
      totalCallDuration: row.total_call_duration || 0,
      totalRatings: row.total_ratings || 0,
      totalRatingScore: row.total_rating_score || 0,
      currentStreak: row.current_streak || 0,
      lastMatchDate: row.last_match_date || "",
      createdAt: row.created_at?.toISOString() || "",
    },
    connectedAt: Date.now(),
    wsClient: null as any, // WS 连接由内存管理
  };
}

function mapRowToCallRecord(row: any): CallRecord {
  return {
    matchId: row.match_id,
    peerId: row.peer_id,
    peerNickname: row.peer_nickname,
    peerGender: row.peer_gender,
    peerAvatarId: row.peer_avatar_id,
    peerLevel: row.peer_level,
    callDuration: row.call_duration,
    startedAt: row.started_at?.toISOString?.() || row.started_at,
    myRating: row.my_rating,
    unlimited: row.unlimited || false,
  };
}
