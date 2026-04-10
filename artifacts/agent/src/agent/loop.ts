import { callLLM, type LLMMessage } from "../llm/index.js";
import { executeTool } from "../tools/index.js";
import { messageStore, memoryStore } from "../memory/db.js";
import { config } from "../config/index.js";

export interface AgentRunOptions {
  userId: number;
  userMessage: string;
}

export interface AgentRunResult {
  reply: string;
  iterations: number;
}

export async function runAgentLoop(opts: AgentRunOptions): Promise<AgentRunResult> {
  const { userId, userMessage } = opts;

  messageStore.add(userId, "user", userMessage);

  const storedMemory = memoryStore.getAll(userId);
  const memoryContext =
    Object.keys(storedMemory).length > 0
      ? `\n\nPersistent memory about this user:\n${Object.entries(storedMemory)
          .map(([k, v]) => `- ${k}: ${v}`)
          .join("\n")}`
      : "";

  const systemPrompt = config.agent.systemPrompt + memoryContext;

  const history = messageStore.getHistory(userId, 40);

  const messages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
    ...history.map((m): LLMMessage => {
      if (m.role === "tool") {
        return {
          role: "tool",
          content: m.content,
          toolCallId: m.toolName ?? "unknown",
          toolName: m.toolName,
        };
      }
      return { role: m.role as "user" | "assistant", content: m.content };
    }),
  ];

  let iterations = 0;
  const maxIterations = config.agent.maxIterations;

  while (iterations < maxIterations) {
    iterations++;
    console.log(`[Agent] Iteration ${iterations}/${maxIterations}`);

    const response = await callLLM(messages);

    if (response.toolCalls && response.toolCalls.length > 0) {
      const assistantMsg: LLMMessage = {
        role: "assistant",
        content: response.content,
        toolCalls: response.toolCalls,
      };
      messages.push(assistantMsg);

      messageStore.add(
        userId,
        "assistant",
        JSON.stringify({ toolCalls: response.toolCalls, content: response.content })
      );

      for (const toolCall of response.toolCalls) {
        console.log(`[Agent] Executing tool: ${toolCall.name}`);
        const result = await executeTool(toolCall, userId);

        const toolMsg: LLMMessage = {
          role: "tool",
          content: result.result,
          toolCallId: result.toolCallId,
          toolName: result.name,
        };
        messages.push(toolMsg);

        messageStore.add(userId, "tool", result.result, result.name);
        console.log(`[Agent] Tool result: ${result.result.substring(0, 100)}...`);
      }

      continue;
    }

    const finalReply = response.content ?? "I'm sorry, I couldn't generate a response.";
    messageStore.add(userId, "assistant", finalReply);

    return { reply: finalReply, iterations };
  }

  const limitReply =
    "I've reached the maximum number of reasoning steps. Please try rephrasing your request.";
  messageStore.add(userId, "assistant", limitReply);
  return { reply: limitReply, iterations };
}
