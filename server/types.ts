import type { WebSocket } from "ws";

// ============================================
// WebSocket Types
// ============================================

export interface WSClient extends WebSocket {
  sessionId?: string;
  isAlive?: boolean;
  isAuthenticated?: boolean;
}

// ============================================
// Data Models
// ============================================

export interface Chat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export type MessageRole = "user" | "assistant" | "tool_use" | "system";

export interface ChatMessage {
  id: string;
  chatId: string;
  role: MessageRole;
  content: string;
  toolName?: string;
  toolInput?: any;
  metadata?: any;
  timestamp?: string;
  createdAt?: string;
}

// ============================================
// WebSocket Message Types (Incoming)
// ============================================

export enum WSMessageType {
  Subscribe = "subscribe",
  Chat = "chat",
}

export interface WSSubscribeMessage {
  type: WSMessageType.Subscribe;
  chatId: string;
}

export interface WSChatMessage {
  type: WSMessageType.Chat;
  content: string;
  chatId: string;
}

export type IncomingWSMessage = WSChatMessage | WSSubscribeMessage;

// ============================================
// WebSocket Message Types (Outgoing)
// ============================================

export enum WSOutgoingType {
  Connected = "connected",
  History = "history",
  UserMessage = "user_message",
  AssistantMessage = "assistant_message",
  ToolUse = "tool_use",
  Result = "result",
  Error = "error",
}

export interface WSOutgoingBase {
  type: WSOutgoingType;
  chatId?: string;
}

export interface WSConnectedMessage extends WSOutgoingBase {
  type: WSOutgoingType.Connected;
  message: string;
}

export interface WSHistoryMessage extends WSOutgoingBase {
  type: WSOutgoingType.History;
  messages: ChatMessage[];
}

export interface WSErrorMessage extends WSOutgoingBase {
  type: WSOutgoingType.Error;
  error: string;
}
