/**
 * PostgreSQL 连接池管理
 * 仅在 DATABASE_URL 环境变量存在时连接数据库
 */

import { Pool, PoolConfig } from "pg";

let pool: Pool | null = null;

export function isDBEnabled(): boolean {
  return !!process.env.DATABASE_URL;
}

export function getPool(): Pool {
  if (!isDBEnabled()) {
    throw new Error("Database not configured. Set DATABASE_URL environment variable.");
  }
  if (!pool) {
    const poolConfig: PoolConfig = {
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

    pool = new Pool(poolConfig);

    pool.on("error", (err) => {
      console.error("[DB] Unexpected pool error:", err.message);
    });

    pool.on("connect", () => {
      console.log("[DB] New client connected");
    });
  }
  return pool;
}

/**
 * 初始化数据库（执行迁移）
 */
export async function initDB(): Promise<void> {
  if (!isDBEnabled()) {
    console.log("[DB] No DATABASE_URL, skipping database init");
    return;
  }

  const p = getPool();
  try {
    const result = await p.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
      );
    `);

    if (result.rows[0].exists) {
      console.log("[DB] Database already initialized");
      return;
    }

    console.log("[DB] Running schema migration...");
    const fs = await import("fs");
    const path = await import("path");
    const schema = fs.readFileSync(
      path.join(__dirname, "schema.sql"),
      "utf-8"
    );
    await p.query(schema);
    console.log("[DB] Schema migration completed");
  } catch (err) {
    console.error("[DB] Init failed:", err);
    throw err;
  }
}

/**
 * 关闭连接池
 */
export async function closeDB(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log("[DB] Pool closed");
  }
}
