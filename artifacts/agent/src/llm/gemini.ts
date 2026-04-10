import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { config } from "../config/index.js";
import { tools } from "../tools/index.js";
import type { LLMMessage, LLMResponse } from "./types.js";

let _client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!_client) {
    _client = new GoogleGenerativeAI(config.gemini.apiKey);
  }
  return _client;
}

function buildGeminiTools() {
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: {
          type: "OBJECT" as const,
          properties: Object.fromEntries(
            Object.entries(t.parameters.properties).map(([k, v]) => [
              k,
              { type: v.type.toUpperCase(), description: v.description },
            ])
          ),
          required: t.parameters.required,
        },
      })),
    },
  ];
}

function toGeminiHistory(messages: LLMMessage[]) {
  const history: { role: string; parts: Part[] }[] = [];

  for (const m of messages) {
    if (m.role === "system") continue;

    if (m.role === "user") {
      history.push({ role: "user", parts: [{ text: m.content ?? "" }] });
    } else if (m.role === "assistant") {
      if (m.toolCalls && m.toolCalls.length > 0) {
        history.push({
          role: "model",
          parts: m.toolCalls.map((tc) => ({
            functionCall: { name: tc.name, args: tc.args },
          })),
        });
      } else {
        history.push({ role: "model", parts: [{ text: m.content ?? "" }] });
      }
    } else if (m.role === "tool") {
      history.push({
        role: "function",
        parts: [
          {
            functionResponse: {
              name: m.toolName ?? "unknown",
              response: { result: m.content },
            },
          },
        ],
      });
    }
  }
  return history;
}

export async function callGemini(messages: LLMMessage[]): Promise<LLMResponse> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: config.gemini.model,
    tools: buildGeminiTools(),
  });

  const systemMsg = messages.find((m) => m.role === "system");
  const nonSystem = messages.filter((m) => m.role !== "system");

  const history = toGeminiHistory(nonSystem.slice(0, -1));
  const lastMsg = nonSystem[nonSystem.length - 1];

  const chat = model.startChat({
    history,
    systemInstruction: systemMsg?.content ?? undefined,
  });

  const result = await chat.sendMessage(lastMsg?.content ?? "");
  const response = result.response;

  const functionCalls = response.functionCalls();
  if (functionCalls && functionCalls.length > 0) {
    return {
      content: null,
      toolCalls: functionCalls.map((fc, i) => ({
        id: `gemini-tool-${i}-${Date.now()}`,
        name: fc.name,
        args: fc.args as Record<string, unknown>,
      })),
      finishReason: "tool_calls",
    };
  }

  return {
    content: response.text(),
    toolCalls: undefined,
    finishReason: "stop",
  };
}
