import { Bot, type Context } from "grammy";
import { config } from "../config/index.js";
import { runAgentLoop } from "../agent/loop.js";
import { messageStore } from "../memory/db.js";

export function createBot(): Bot {
  const bot = new Bot(config.telegram.botToken);

  bot.use(authMiddleware);

  bot.command("start", handleStart);
  bot.command("help", handleHelp);
  bot.command("clear", handleClear);
  bot.command("memory", handleMemory);

  bot.on("message:text", handleMessage);

  bot.catch((err) => {
    console.error("[Bot] Unhandled error:", err.message);
  });

  return bot;
}

function isAllowed(userId: number): boolean {
  return config.telegram.allowedUserIds.includes(userId);
}

async function authMiddleware(ctx: Context, next: () => Promise<void>): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId || !isAllowed(userId)) {
    console.warn(`[Security] Blocked unauthorized user: ${userId ?? "unknown"}`);
    await ctx.reply("⛔ Access denied. You are not authorized to use this bot.");
    return;
  }
  await next();
}

async function handleStart(ctx: Context): Promise<void> {
  const name = ctx.from?.first_name ?? "there";
  await ctx.reply(
    `Hello, ${name}! I'm BaraaClaw, your personal AI agent.\n\n` +
      `I can think, use tools, and remember things across conversations.\n\n` +
      `Commands:\n` +
      `/help — show this message\n` +
      `/clear — clear conversation history\n` +
      `/memory — view stored facts\n\n` +
      `Just send me a message to get started.`
  );
}

async function handleHelp(ctx: Context): Promise<void> {
  await ctx.reply(
    `BaraaClaw — Personal AI Agent\n\n` +
      `Commands:\n` +
      `/start — introduction\n` +
      `/help — this message\n` +
      `/clear — clear conversation history\n` +
      `/memory — view stored memory\n\n` +
      `Available tools:\n` +
      `• get_current_time — check current date/time\n` +
      `• remember_fact — store a fact persistently\n` +
      `• recall_fact — retrieve a stored fact\n` +
      `• list_memory — see all stored facts\n\n` +
      `Just chat naturally — I'll use tools when needed.`
  );
}

async function handleClear(ctx: Context): Promise<void> {
  const userId = ctx.from!.id;
  messageStore.clear(userId);
  await ctx.reply("Conversation history cleared. Fresh start!");
}

async function handleMemory(ctx: Context): Promise<void> {
  const userId = ctx.from!.id;
  const { memoryStore } = await import("../memory/db.js");
  const all = memoryStore.getAll(userId);
  const entries = Object.entries(all);

  if (entries.length === 0) {
    await ctx.reply("No facts stored in memory yet.");
    return;
  }

  const lines = entries.map(([k, v]) => `• ${k}: ${v}`).join("\n");
  await ctx.reply(`Stored memory:\n\n${lines}`);
}

async function handleMessage(ctx: Context): Promise<void> {
  const userId = ctx.from!.id;
  const userMessage = ctx.message?.text;

  if (!userMessage) return;

  console.log(`[Bot] Message from ${userId}: ${userMessage.substring(0, 60)}...`);

  await ctx.replyWithChatAction("typing");

  try {
    const typingInterval = setInterval(() => {
      ctx.replyWithChatAction("typing").catch(() => {});
    }, 4000);

    const result = await runAgentLoop({ userId, userMessage });

    clearInterval(typingInterval);

    const reply = result.reply;
    const chunkSize = 4096;

    if (reply.length <= chunkSize) {
      await ctx.reply(reply, { parse_mode: "Markdown" });
    } else {
      for (let i = 0; i < reply.length; i += chunkSize) {
        await ctx.reply(reply.slice(i, i + chunkSize));
      }
    }

    console.log(`[Bot] Replied after ${result.iterations} iteration(s)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Bot] Agent error: ${msg}`);
    await ctx.reply(
      "Sorry, I encountered an error while processing your request. Please try again."
    );
  }
}
