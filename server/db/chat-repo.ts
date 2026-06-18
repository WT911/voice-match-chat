/**
 * 聊天数据仓库 - PostgreSQL
 * 替代原 store.ts 的内存存储
 */

import { getPool } from "./pool.js";
import type { Chat, ChatMessage } from "../types.js";

// ============================================
// 聊天会话 CRUD
// ============================================

export async function createChat(userId: string, title?: string): Promise<Chat> {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO chats (user_id, title) VALUES ($1, $2) RETURNING *`,
    [userId, title || "New Chat"]
  );
  return mapRowToChat(result.rows[0]);
}

export async function getChat(chatId: string): Promise<Chat | null> {
  const pool = getPool();
  const result = await pool.query("SELECT * FROM chats WHERE id = $1", [chatId]);
  return result.rows[0] ? mapRowToChat(result.rows[0]) : null;
}

export async function getAllChats(userId: string): Promise<Chat[]> {
  const pool = getPool();
  const result = await pool.query(
    "SELECT * FROM chats WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 50",
    [userId]
  );
  return result.rows.map(mapRowToChat);
}

export async function deleteChat(chatId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query("DELETE FROM chats WHERE id = $1", [chatId]);
  return (result.rowCount ?? 0) > 0;
}

// ============================================
// 消息 CRUD
// ============================================

export async function addMessage(
  chatId: string,
  role: string,
  content: string,
  toolName?: string,
  toolInput?: any,
  metadata?: any
): Promise<ChatMessage> {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO chat_messages (chat_id, role, content, tool_name, tool_input, metadata)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [chatId, role, content, toolName || null, toolInput ? JSON.stringify(toolInput) : null, metadata ? JSON.stringify(metadata) : null]
  );

  // 更新 chat 的 updated_at
  await pool.query("UPDATE chats SET updated_at = NOW() WHERE id = $1", [chatId]);

  return mapRowToMessage(result.rows[0]);
}

export async function getMessages(chatId: string, limit = 100): Promise<ChatMessage[]> {
  const pool = getPool();
  const result = await pool.query(
    "SELECT * FROM chat_messages WHERE chat_id = $1 ORDER BY created_at ASC LIMIT $2",
    [chatId, limit]
  );
  return result.rows.map(mapRowToMessage);
}

// ============================================
// 行映射
// ============================================

function mapRowToChat(row: any): Chat {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at?.toISOString?.() || new Date().toISOString(),
    updatedAt: row.updated_at?.toISOString?.() || new Date().toISOString(),
  };
}

function mapRowToMessage(row: any): ChatMessage {
  return {
    id: row.id,
    chatId: row.chat_id,
    role: row.role,
    content: row.content,
    toolName: row.tool_name || undefined,
    toolInput: row.tool_input || undefined,
    metadata: row.metadata || {},
    createdAt: row.created_at?.toISOString?.() || new Date().toISOString(),
  };
}
