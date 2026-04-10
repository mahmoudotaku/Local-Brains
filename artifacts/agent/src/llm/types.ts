import type { ToolCall } from "../tools/index.js";

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  toolName?: string;
}

export interface LLMResponse {
  content: string | null;
  toolCalls?: ToolCall[];
  finishReason: string;
}
