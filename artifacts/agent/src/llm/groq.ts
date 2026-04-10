import Groq from "groq-sdk";
import { config } from "../config/index.js";
import { tools } from "../tools/index.js";
import type { LLMMessage, LLMResponse } from "./types.js";

let _client: Groq | null = null;

function getClient(): Groq {
  if (!_client) {
    _client = new Groq({ apiKey: config.groq.apiKey });
  }
  return _client;
}

function buildGroqTools(): Groq.Chat.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

function toGroqMessages(
  messages: LLMMessage[]
): Groq.Chat.ChatCompletionMessageParam[] {
  return messages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "tool" as const,
        tool_call_id: m.toolCallId!,
        content: m.content,
      };
    }
    if (m.role === "assistant" && m.toolCalls) {
      return {
        role: "assistant" as const,
        content: m.content ?? null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.args),
          },
        })),
      };
    }
    return {
      role: m.role as "user" | "assistant" | "system",
      content: m.content ?? "",
    };
  });
}

export async function callGroq(messages: LLMMessage[]): Promise<LLMResponse> {
  const client = getClient();
  const response = await client.chat.completions.create({
    model: config.groq.model,
    messages: toGroqMessages(messages),
    tools: buildGroqTools(),
    tool_choice: "auto",
    max_tokens: 4096,
  });

  const choice = response.choices[0];
  if (!choice) throw new Error("No response from Groq");

  const message = choice.message;
  const toolCalls = message.tool_calls?.map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    args: (() => {
      try {
        return JSON.parse(tc.function.arguments) as Record<string, unknown>;
      } catch {
        return {};
      }
    })(),
  }));

  return {
    content: message.content ?? null,
    toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
    finishReason: choice.finish_reason ?? "stop",
  };
}
