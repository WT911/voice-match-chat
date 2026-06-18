import { v4 as uuidv4 } from "uuid";
import type { Chat, ChatMessage } from "./types.js";
import { config } from "./config.js";

const { maxMessagesPerChat, maxChats, defaultTitle, titleMaxLength } = config.chat;

/**
 * In-memory store for chats with automatic cleanup
 * Features:
 * - LRU eviction when maxChats is exceeded
 * - Message count limiting per chat
 */
class ChatStore {
  private chats: Map<string, Chat> = new Map();
  private messages: Map<string, ChatMessage[]> = new Map();

  createChat(title?: string): Chat {
    // Evict oldest chat if at capacity
    if (this.chats.size >= maxChats) {
      this.evictOldestChat();
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const chat: Chat = {
      id,
      title: title || defaultTitle,
      createdAt: now,
      updatedAt: now,
    };
    this.chats.set(id, chat);
    this.messages.set(id, []);
    return chat;
  }

  getChat(id: string): Chat | undefined {
    return this.chats.get(id);
  }

  getAllChats(): Chat[] {
    return Array.from(this.chats.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  updateChatTitle(id: string, title: string): Chat | undefined {
    const chat = this.chats.get(id);
    if (chat) {
      chat.title = title;
      chat.updatedAt = new Date().toISOString();
    }
    return chat;
  }

  deleteChat(id: string): boolean {
    this.messages.delete(id);
    return this.chats.delete(id);
  }

  addMessage(chatId: string, message: Omit<ChatMessage, "id" | "chatId" | "timestamp">): ChatMessage {
    const messages = this.messages.get(chatId);
    if (!messages) {
      throw new Error(`Chat ${chatId} not found`);
    }

    const newMessage: ChatMessage = {
      id: uuidv4(),
      chatId,
      timestamp: new Date().toISOString(),
      ...message,
    };
    messages.push(newMessage);

    // Enforce message limit (keep most recent)
    if (messages.length > maxMessagesPerChat) {
      const excess = messages.length - maxMessagesPerChat;
      messages.splice(0, excess);
    }

    // Update chat's updatedAt
    const chat = this.chats.get(chatId);
    if (chat) {
      chat.updatedAt = newMessage.timestamp;

      // Auto-generate title from first user message
      if (chat.title === defaultTitle && message.role === "user") {
        chat.title = this.truncateTitle(message.content);
      }
    }

    return newMessage;
  }

  getMessages(chatId: string): ChatMessage[] {
    return this.messages.get(chatId) || [];
  }

  getStats() {
    return {
      chatCount: this.chats.size,
      totalMessages: Array.from(this.messages.values()).reduce((sum, msgs) => sum + msgs.length, 0),
    };
  }

  private truncateTitle(content: string): string {
    const cleaned = content.replace(/\s+/g, ' ').trim();
    if (cleaned.length <= titleMaxLength) {
      return cleaned;
    }
    return cleaned.slice(0, titleMaxLength) + '...';
  }

  private evictOldestChat() {
    const chats = this.getAllChats();
    if (chats.length > 0) {
      const oldest = chats[chats.length - 1];
      console.log(`[ChatStore] Evicting oldest chat: ${oldest.id}`);
      this.deleteChat(oldest.id);
    }
  }
}

// Singleton instance
export const chatStore = new ChatStore();
