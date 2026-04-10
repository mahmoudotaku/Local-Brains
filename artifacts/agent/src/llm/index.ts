import { callGroq } from "./groq.js";
import { callGemini } from "./gemini.js";
import type { LLMMessage, LLMResponse } from "./types.js";

export type { LLMMessage, LLMResponse };

export async function callLLM(messages: LLMMessage[]): Promise<LLMResponse> {
  try {
    console.log("[LLM] Calling Groq (primary)...");
    return await callGroq(messages);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isRateLimit =
      msg.toLowerCase().includes("rate") ||
      msg.toLowerCase().includes("limit") ||
      msg.toLowerCase().includes("quota") ||
      msg.toLowerCase().includes("429");

    if (isRateLimit) {
      console.warn("[LLM] Groq rate limit hit, falling back to Gemini...");
    } else {
      console.warn(`[LLM] Groq error: ${msg}. Falling back to Gemini...`);
    }

    return await callGemini(messages);
  }
}
