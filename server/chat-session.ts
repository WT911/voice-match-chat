import type { WSClient } from "./types.js";
import { Agent } from "./agent.js";
import { chatRepo } from "./db/index.js";

/**
 * ChatSession manages a single chat conversation with a long-lived agent.
 * Handles message routing between WebSocket clients and the AI agent.
 * Production: messages persisted to PostgreSQL.
 */
export class ChatSession {
  public readonly chatId: string;
  private subscribers: Set<WSClient> = new Set();
  private agent: Agent;
  private isListening = false;
  private useDatabase: boolean;

  constructor(chatId: string) {
    this.chatId = chatId;
    this.agent = new Agent();
    this.useDatabase = !!process.env.DATABASE_URL;
  }

  // Start listening to agent output (call once)
  private async startListening() {
    if (this.isListening) return;
    this.isListening = true;
    console.log(`[ChatSession ${this.chatId}] Starting to listen for agent output...`);

    try {
      for await (const message of this.agent.getOutputStream()) {
        console.log(`[ChatSession ${this.chatId}] Received message:`, message.type);
        this.handleSDKMessage(message);
      }
    } catch (error) {
      console.error(`Error in ChatSession ${this.chatId}:`, error);
      this.broadcastError((error as Error).message);
    } finally {
      this.isListening = false;
      console.log(`[ChatSession ${this.chatId}] Stream ended, listening state reset`);
    }
  }

  // Send a user message to the agent
  async sendMessage(content: string) {
    console.log(`[ChatSession ${this.chatId}] Received user message:`, content);

    // Store user message (DB or memory fallback)
    if (this.useDatabase) {
      await chatRepo.addMessage(this.chatId, "user", content).catch(() => {});
    }

    // Broadcast user message to subscribers
    this.broadcast({
      type: "user_message",
      content,
      chatId: this.chatId,
    });

    // Send to agent and start listening
    await this.agent.sendMessage(content);

    if (!this.isListening) {
      console.log(`[ChatSession ${this.chatId}] Starting listener...`);
      this.startListening();
    }
  }

  private handleSDKMessage(message: any) {
    if (message.type === "assistant") {
      const content = message.message.content;

      if (typeof content === "string") {
        if (this.useDatabase) {
          chatRepo.addMessage(this.chatId, "assistant", content).catch(() => {});
        }
        this.broadcast({
          type: "assistant_message",
          content,
          chatId: this.chatId,
        });
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "text") {
            if (this.useDatabase) {
              chatRepo.addMessage(this.chatId, "assistant", block.text).catch(() => {});
            }
            this.broadcast({
              type: "assistant_message",
              content: block.text,
              chatId: this.chatId,
            });
          } else if (block.type === "tool_use") {
            if (this.useDatabase) {
              chatRepo.addMessage(
                this.chatId, "tool_use", "",
                block.name, block.input
              ).catch(() => {});
            }
            this.broadcast({
              type: "tool_use",
              toolName: block.name,
              toolId: block.id,
              toolInput: block.input,
              chatId: this.chatId,
            });
          }
        }
      }
    } else if (message.type === "result") {
      this.broadcast({
        type: "result",
        success: message.subtype === "success",
        chatId: this.chatId,
        cost: message.total_cost_usd,
        duration: message.duration_ms,
      });
    }
  }

  subscribe(client: WSClient) {
    this.subscribers.add(client);
    client.sessionId = this.chatId;
  }

  unsubscribe(client: WSClient) {
    this.subscribers.delete(client);
  }

  hasSubscribers(): boolean {
    return this.subscribers.size > 0;
  }

  private broadcast(message: any) {
    const messageStr = JSON.stringify(message);
    for (const client of this.subscribers) {
      try {
        if (client.readyState === client.OPEN) {
          client.send(messageStr);
        }
      } catch (error) {
        console.error("Error broadcasting to client:", error);
        this.subscribers.delete(client);
      }
    }
  }

  private broadcastError(error: string) {
    this.broadcast({
      type: "error",
      error,
      chatId: this.chatId,
    });
  }

  close() {
    this.agent.close();
  }
}
