import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import type { WSClient, IncomingWSMessage } from "./types.js";
import { chatStore } from "./store.js";
import { ChatSession } from "./chat-session.js";
import { config } from "./config.js";
import { handleVoiceMatchMessage, notifyMatchFound, setupMatchCallbacks } from "./voice-match-handler.js";
import { matchQueue } from "./matching.js";
import { userStore } from "./user-store.js";
import { levelSystem } from "./level-system.js";

// ==========================================
// 生产环境: 数据库 + 鉴权
// ==========================================
import { initDB, closeDB, userRepo, chatRepo, matchRepo } from "./db/index.js";
import {
  signTokens,
  refreshAccessToken,
  verifyToken,
  verifyWSConnection,
  generateWechatLoginURL,
  handleWechatCallback,
  authMiddleware,
} from "./auth.js";
import type { AuthRequest } from "./auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { port: PORT, wsPath: WS_PATH } = config.server;

// ==========================================
// Express app
// ==========================================
const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from dist (production) or client (dev fallback)
const distPath = path.join(__dirname, "../dist");
app.use(express.static(distPath, { index: false }));

// Serve index.html at root
app.get("/", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// ==========================================
// 鉴权 API (无需登录)
// ==========================================

// 获取微信登录 URL
app.get("/api/auth/wechat/url", (req, res) => {
  const redirectUri = (req.query.redirect as string) || `${req.protocol}://${req.get("host")}`;
  const url = generateWechatLoginURL(redirectUri);
  res.json({ url });
});

// 微信 OAuth 回调
app.post("/api/auth/wechat/callback", async (req, res) => {
  try {
    const { code, state } = req.body;
    if (!code || !state) {
      return res.status(400).json({ error: "Missing code or state" });
    }

    const result = await handleWechatCallback(code, state);
    if (!result) {
      return res.status(401).json({ error: "Login failed", message: "微信登录失败" });
    }

    res.json({
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      expiresIn: result.tokens.expiresIn,
      user: {
        userId: result.user.userId,
        nickname: result.user.nickname,
        avatarUrl: result.user.voiceIntro ? undefined : undefined,
        level: result.user.level,
        gender: result.user.gender,
        tags: result.user.tags,
        zodiac: result.user.zodiac,
        avatarId: result.user.avatarId,
        needSetup: result.isNewUser,
      },
      isNewUser: result.isNewUser,
    });
  } catch (err: any) {
    console.error("[Auth] Callback error:", err);
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// 刷新 Token
app.post("/api/auth/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: "Missing refreshToken" });
    }

    const tokens = await refreshAccessToken(refreshToken);
    if (!tokens) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    res.json(tokens);
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// 验证 Token
app.get("/api/auth/verify", authMiddleware, (req: AuthRequest, res) => {
  res.json({ userId: req.userId, valid: true });
});

// 开发环境模拟登录
if (process.env.NODE_ENV !== "production") {
  app.post("/api/auth/dev-login", async (req, res) => {
    try {
      const { openId } = req.body;
      if (!openId) return res.status(400).json({ error: "Missing openId" });

      let userId: string;
      let nickname: string;
      let isNewUser = false;

      // 尝试数据库
      if (process.env.DATABASE_URL) {
        let user = await userRepo.getUserByOpenid(openId);
        if (!user) {
          user = await userRepo.createUser({
            wechatOpenid: openId,
            nickname: `用户${openId.slice(-4)}`,
            gender: "male",
            tags: [],
            zodiac: "",
          });
          isNewUser = true;
        }
        userId = user.userId;
        nickname = user.nickname;

        const tokens = signTokens(userId);
        await matchRepo.saveRefreshToken(userId, tokens.refreshToken, 7 * 24 * 3600);

        return res.json({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
          user: { userId, nickname, level: user.level, gender: user.gender, tags: user.tags, zodiac: user.zodiac, avatarId: user.avatarId, needSetup: isNewUser },
          isNewUser,
        });
      }

      // 内存 fallback
      userId = `dev_${openId}`;
      nickname = `用户${openId.slice(-4)}`;
      isNewUser = true;

      const tokens = signTokens(userId);

      res.json({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        user: { userId, nickname, level: 0, gender: "male", tags: [], zodiac: "", avatarId: 1, needSetup: true },
        isNewUser,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}

// ==========================================
// REST API - Chat (需要登录)
// ==========================================

app.get("/api/chats", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const chats = await chatRepo.getAllChats(req.userId!);
    res.json(chats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/chats", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const chat = await chatRepo.createChat(req.userId!, req.body?.title);
    res.status(201).json(chat);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/chats/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const chat = await chatRepo.getChat(req.params.id);
    if (!chat) return res.status(404).json({ error: "Chat not found" });
    res.json(chat);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/chats/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const deleted = await chatRepo.deleteChat(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Chat not found" });
    const session = sessions.get(req.params.id);
    if (session) {
      session.close();
      sessions.delete(req.params.id);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/chats/:id/messages", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const messages = await chatRepo.getMessages(req.params.id);
    res.json(messages);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// REST API - Voice Match
// ==========================================

// 获取所有等级配置 (公开)
app.get("/api/voice-match/levels", (req, res) => {
  res.json(levelSystem.getAllConfigs());
});

// 获取用户信息 (需要登录)
app.get("/api/voice-match/profile/:userId", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await userRepo.getUserById(req.params.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const progress = levelSystem.getProgress(user.experience);
    const callRecords = await userRepo.getCallRecords(req.params.userId);
    res.json({
      userId: user.userId,
      nickname: user.nickname,
      gender: user.gender,
      tags: user.tags,
      zodiac: user.zodiac,
      voiceIntro: user.voiceIntro,
      avatarId: user.avatarId,
      level: user.level,
      experience: user.experience,
      pricePerMinute: user.pricePerMinute,
      stats: user.stats,
      callRecords,
      levelProgress: progress,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 获取 WebRTC 配置 (公开)
app.get("/api/voice-match/webrtc-config", (req, res) => {
  res.json({
    turnUrl: process.env.TURN_URL || "",
    turnUsername: process.env.TURN_USERNAME || "",
    turnCredential: process.env.TURN_CREDENTIAL || "",
  });
});

// ==========================================
// Session management (in-memory for WebSocket sessions)
// ==========================================
const sessions: Map<string, ChatSession> = new Map();

function getOrCreateSession(chatId: string): ChatSession {
  let session = sessions.get(chatId);
  if (!session) {
    session = new ChatSession(chatId);
    sessions.set(chatId, session);
  }
  return session;
}

// ==========================================
// WebSocket Server
// ==========================================

const server = createServer(app);
const wss = new WebSocketServer({ server, path: WS_PATH });

// 注册匹配成功回调
matchQueue.setOnMatch((matchId, userId1, userId2) => {
  notifyMatchFound(matchId, userId1, userId2);
});

// 初始化限时/互赞回调
setupMatchCallbacks();

wss.on("connection", (ws: WSClient, req) => {
  console.log("WebSocket client connected");

  // WebSocket 鉴权：从 URL query 中获取 token
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const token = url.searchParams.get("token");

  if (token) {
    const userId = verifyWSConnection(token);
    if (userId) {
      ws.sessionId = userId;
      ws.isAuthenticated = true;
      console.log(`[WS] Authenticated user: ${userId.slice(0, 8)}`);
    }
  }

  ws.isAlive = true;

  ws.send(JSON.stringify({
    type: "connected",
    message: "Connected to chat server",
    authenticated: !!ws.isAuthenticated,
  }));

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", async (data) => {
    try {
      const raw = JSON.parse(data.toString());
      const msgType = raw.type as string;

      // Chat messages (需要登录)
      if (msgType === "subscribe" || msgType === "chat") {
        if (!ws.isAuthenticated) {
          ws.send(JSON.stringify({ type: "error", error: "请先登录" }));
          return;
        }

        const message = raw as IncomingWSMessage;
        switch (message.type) {
          case "subscribe": {
            const session = getOrCreateSession(message.chatId);
            session.subscribe(ws);
            // 从数据库加载历史消息
            const messages = await chatRepo.getMessages(message.chatId);
            ws.send(JSON.stringify({ type: "history", messages, chatId: message.chatId }));
            break;
          }
          case "chat": {
            const session = getOrCreateSession(message.chatId);
            session.subscribe(ws);
            // 保存用户消息到数据库
            await chatRepo.addMessage(message.chatId, "user", message.content);
            await session.sendMessage(message.content);
            break;
          }
        }
        return;
      }

      // Voice match messages
      if (msgType.startsWith("voice_match:")) {
        await handleVoiceMatchMessage(ws, raw as any);
        return;
      }

      console.warn("Unknown message type:", msgType);
    } catch (error) {
      console.error("Error handling WebSocket message:", error);
      ws.send(JSON.stringify({ type: "error", error: "Invalid message format" }));
    }
  });

  ws.on("close", () => {
    console.log("WebSocket client disconnected");
    for (const session of sessions.values()) {
      session.unsubscribe(ws);
    }
    const user = userStore.getUserByWS(ws);
    if (user) {
      matchQueue.leaveQueue(user.userId);
    }
    userStore.removeByWS(ws);
  });
});

// Heartbeat
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    const client = ws as WSClient;
    if (client.isAlive === false) {
      return client.terminate();
    }
    client.isAlive = false;
    client.ping();
  });
}, config.websocket.heartbeatInterval);

// 定期清理过期匹配会话
const sessionCleanup = setInterval(() => {
  matchQueue.cleanupStaleSessions();
}, config.voiceMatch.cleanupIntervalMs);

wss.on("close", () => {
  clearInterval(heartbeat);
  clearInterval(sessionCleanup);
});

// ==========================================
// Start server
// ==========================================

async function start() {
  // 尝试初始化数据库
  try {
    if (process.env.DATABASE_URL) {
      await initDB();
      console.log("[DB] Database initialized");
    } else {
      console.log("[DB] No DATABASE_URL, using in-memory fallback");
    }
  } catch (err: any) {
    console.warn("[DB] Database init failed, using in-memory fallback:", err.message);
  }

  server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`WebSocket endpoint at ws://localhost:${PORT}${WS_PATH}`);
    console.log(`Voice Match system ready`);
    console.log(`Auth system ready`);
  });
}

// 优雅关闭
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down...");
  clearInterval(heartbeat);
  clearInterval(sessionCleanup);
  wss.close();
  server.close();
  await closeDB();
  process.exit(0);
});

start();
