/**
 * 微信 OAuth 2.0 扫码登录 + JWT 鉴权
 */

import crypto from "crypto";
import jwt from "jsonwebtoken";
import { matchRepo, userRepo } from "./db/index.js";

// ============================================
// 配置
// ============================================

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
const REFRESH_TOKEN_EXPIRES_IN = 7 * 24 * 3600; // 7 天

const WECHAT_APP_ID = process.env.WECHAT_APP_ID || "";
const WECHAT_APP_SECRET = process.env.WECHAT_APP_SECRET || "";

// ============================================
// JWT 签发 & 验证
// ============================================

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export function signTokens(userId: string): TokenPair {
  const accessToken = jwt.sign({ sub: userId, type: "access" }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  const refreshToken = crypto.randomBytes(48).toString("hex");

  return {
    accessToken,
    refreshToken,
    expiresIn: parseExpiresIn(JWT_EXPIRES_IN),
  };
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<TokenPair | null> {
  // 检查是否有数据库连接
  if (!process.env.DATABASE_URL) {
    // 无数据库时：用 JWT 验证替代
    try {
      const payload = jwt.verify(refreshToken, JWT_SECRET) as any;
      if (payload.type !== "refresh") return null;
      return signTokens(payload.sub);
    } catch {
      return null;
    }
  }

  const userId = await matchRepo.validateRefreshToken(refreshToken);
  if (!userId) return null;

  // 撤销旧 token
  await matchRepo.revokeRefreshToken(refreshToken);

  const tokens = signTokens(userId);
  await matchRepo.saveRefreshToken(userId, tokens.refreshToken, REFRESH_TOKEN_EXPIRES_IN);
  return tokens;
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type !== "access") return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}

// ============================================
// WebSocket 鉴权中间件
// ============================================

export function verifyWSConnection(token: string): string | null {
  const result = verifyToken(token);
  return result?.userId || null;
}

// ============================================
// 微信 OAuth 流程
// ============================================

/**
 * 生成微信 OAuth 扫码登录 URL
 */
export function generateWechatLoginURL(redirectUri: string): string {
  const state = crypto.randomBytes(16).toString("hex");
  // 保存 state 用于回调验证
  matchRepo.saveWechatState(state, 600).catch((e) =>
    console.error("[Auth] Failed to save state:", e)
  );

  const params = new URLSearchParams({
    appid: WECHAT_APP_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "snsapi_userinfo",
    state,
  });

  return `https://open.weixin.qq.com/connect/oauth2/authorize?${params}#wechat_redirect`;
}

/**
 * 微信 OAuth 回调：用 code 换取 access_token 和用户信息
 */
export async function handleWechatCallback(
  code: string,
  state: string
): Promise<{
  user: any;
  tokens: TokenPair;
  isNewUser: boolean;
} | null> {
  // 验证 state
  const validState = await matchRepo.validateWechatState(state);
  if (!validState) {
    console.error("[Auth] Invalid state parameter");
    return null;
  }

  // 1. 用 code 换取 access_token
  const tokenRes = await fetch(
    `https://api.weixin.qq.com/sns/oauth2/access_token?` +
    new URLSearchParams({
      appid: WECHAT_APP_ID,
      secret: WECHAT_APP_SECRET,
      code,
      grant_type: "authorization_code",
    })
  );
  const tokenData = await tokenRes.json() as any;

  if (tokenData.errcode) {
    console.error("[Auth] WeChat token error:", tokenData);
    return null;
  }

  const { access_token, openid, unionid } = tokenData;

  // 2. 获取用户信息
  const userRes = await fetch(
    `https://api.weixin.qq.com/sns/userinfo?` +
    new URLSearchParams({
      access_token,
      openid,
      lang: "zh_CN",
    })
  );
  const userData = await userRes.json() as any;

  if (userData.errcode) {
    console.error("[Auth] WeChat userinfo error:", userData);
    return null;
  }

  // 3. 查找或创建用户
  let user = await userRepo.getUserByOpenid(openid);
  let isNewUser = false;

  if (!user) {
    // 新用户：创建基础记录（性别和标签后续在 GenderSelectModal 中设置）
    user = await userRepo.createUser({
      wechatOpenid: openid,
      wechatUnionid: unionid,
      nickname: userData.nickname || "微信用户",
      avatarUrl: userData.headimgurl || "",
      gender: "male", // 默认，后续在注册向导中修改
      tags: [],
      zodiac: "",
    });
    isNewUser = true;
  } else {
    // 更新昵称和头像
    await userRepo.updateUser(user.userId, {
      nickname: userData.nickname || user.nickname,
      avatarUrl: userData.headimgurl || "",
    });
  }

  // 4. 签发 JWT
  const tokens = signTokens(user.userId);
  await matchRepo.saveRefreshToken(user.userId, tokens.refreshToken, REFRESH_TOKEN_EXPIRES_IN);

  return { user, tokens, isNewUser };
}

// ============================================
// REST API 鉴权中间件
// ============================================

import type { Request, Response, NextFunction } from "express";

export interface AuthRequest extends Request {
  userId?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized", message: "请先登录" });
    return;
  }

  const token = authHeader.slice(7);
  const result = verifyToken(token);

  if (!result) {
    res.status(401).json({ error: "Unauthorized", message: "Token 无效或已过期" });
    return;
  }

  req.userId = result.userId;
  next();
}

// ============================================
// 工具函数
// ============================================

function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) return 900; // 默认 15 分钟
  const num = parseInt(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return num * (multipliers[unit] || 60);
}
