/**
 * Server Configuration
 * Centralized configuration for the chat server
 */

export const config = {
  // Server settings
  server: {
    port: parseInt(process.env.PORT || '4001', 10),
    wsPath: '/ws',
  },

  // Chat settings
  chat: {
    /** Maximum messages per chat before auto-cleanup */
    maxMessagesPerChat: 100,
    /** Maximum number of chats in memory */
    maxChats: 50,
    /** Default title for new chats */
    defaultTitle: '新对话',
    /** Title max length before truncation */
    titleMaxLength: 50,
  },

  // Agent settings
  agent: {
    model: 'claude-4.5' as const,
    maxTurns: 1,
    allowedTools: [
      'Bash',
      'Read',
      'Write',
      'Edit',
      'Glob',
      'Grep',
      'WebSearch',
      'WebFetch',
    ] as const,
  },

  // WebSocket settings
  websocket: {
    heartbeatInterval: 30000,
    reconnectAttempts: 10,
    reconnectInterval: 3000,
  },

  // Voice Match settings
  voiceMatch: {
    /** 匹配超时时间 (毫秒) */
    matchTimeoutMs: 30000,
    /** 会话清理间隔 (毫秒) */
    cleanupIntervalMs: 30000,
    /** 等级上限 */
    levelCap: 6,
    /** 通话限时 (秒) - 3分钟 */
    callTimeLimit: 180,
    /** 在线人数广播间隔 (毫秒) */
    onlineCountIntervalMs: 5000,
  },

  // WebRTC settings (生产环境需配置 TURN 服务器)
  webrtc: {
    iceServers: (() => {
      const servers: { urls: string; username?: string; credential?: string }[] = [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ];
      // 如果配置了 TURN 服务器，添加
      if (process.env.TURN_URL) {
        servers.push({
          urls: process.env.TURN_URL,
          username: process.env.TURN_USERNAME || "",
          credential: process.env.TURN_CREDENTIAL || "",
        });
      }
      return servers;
    })(),
  },
} as const;

export type Config = typeof config;
