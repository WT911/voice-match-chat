/**
 * 匹配 & 评分数据仓库 - PostgreSQL
 */

import { getPool } from "./pool.js";
import type { Rating } from "../voice-match-types.js";

// ============================================
// 匹配评分
// ============================================

export async function addRating(rating: Rating): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO match_ratings (match_id, rater_id, target_id, score, tags, comment)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [rating.matchId, rating.raterId, rating.targetId, rating.score, rating.tags, rating.comment]
  );
}

export async function getMatchRatings(matchId: string): Promise<Rating[]> {
  const pool = getPool();
  const result = await pool.query(
    "SELECT * FROM match_ratings WHERE match_id = $1",
    [matchId]
  );
  return result.rows.map(mapRowToRating);
}

export async function bothRated(matchId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    "SELECT COUNT(*) AS cnt FROM match_ratings WHERE match_id = $1",
    [matchId]
  );
  return parseInt(result.rows[0].cnt) >= 2;
}

// ============================================
// 微信登录状态
// ============================================

export async function saveWechatState(state: string, expiresIn = 600): Promise<void> {
  const pool = getPool();
  await pool.query(
    "INSERT INTO wechat_auth_states (state, expires_at) VALUES ($1, NOW() + $2 * INTERVAL '1 second')",
    [state, expiresIn]
  );
}

export async function validateWechatState(state: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    "DELETE FROM wechat_auth_states WHERE state = $1 AND expires_at > NOW() RETURNING id",
    [state]
  );
  return (result.rowCount ?? 0) > 0;
}

// ============================================
// Refresh Token
// ============================================

export async function saveRefreshToken(userId: string, token: string, expiresIn: number): Promise<void> {
  const pool = getPool();
  await pool.query(
    "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + $3 * INTERVAL '1 second')",
    [userId, token, expiresIn]
  );
}

export async function validateRefreshToken(token: string): Promise<string | null> {
  const pool = getPool();
  const result = await pool.query(
    "SELECT user_id FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()",
    [token]
  );
  return result.rows[0]?.user_id || null;
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const pool = getPool();
  await pool.query("DELETE FROM refresh_tokens WHERE token = $1", [token]);
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  const pool = getPool();
  await pool.query("DELETE FROM refresh_tokens WHERE user_id = $1", [userId]);
}

// ============================================
// 行映射
// ============================================

function mapRowToRating(row: any): Rating {
  return {
    matchId: row.match_id,
    raterId: row.rater_id,
    targetId: row.target_id,
    score: row.score,
    tags: row.tags || [],
    comment: row.comment || "",
    createdAt: row.created_at?.toISOString?.() || new Date().toISOString(),
  };
}
