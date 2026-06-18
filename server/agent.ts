import { query } from "@tencent-ai/agent-sdk";
import { config } from "./config.js";

const SYSTEM_PROMPT = `你是一个乐于助人的 AI 助手。你可以帮助用户完成各种任务，包括：
- 回答问题
- 撰写和编辑文本
- 编程和调试代码
- 分析和研究
- 创意任务

请保持回复简洁但全面。`;

/**
 * Agent wrapper for CodeBuddy Agent SDK.
 * Manages a single query stream and provides async iteration.
 */
export class Agent {
  private currentStream: AsyncIterator<any> | null = null;

  async sendMessage(content: string) {
    this.currentStream = query({
      prompt: content,
      options: {
        maxTurns: config.agent.maxTurns,
        cwd: process.cwd(),
        model: config.agent.model,
        executable: "node",
        allowedTools: [...config.agent.allowedTools],
        systemPrompt: SYSTEM_PROMPT,
      },
    })[Symbol.asyncIterator]();
  }

  async *getOutputStream() {
    if (!this.currentStream) {
      throw new Error("No active stream. Call sendMessage() first.");
    }
    while (true) {
      const { value, done } = await this.currentStream.next();
      if (done) {
        this.currentStream = null;
        break;
      }
      yield value;
    }
  }

  close() {
    this.currentStream = null;
  }
}
