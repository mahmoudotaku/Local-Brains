import "dotenv/config";
import { config } from "./config/index.js";
import { createBot } from "./telegram/bot.js";

console.log("=================================");
console.log("  BaraaClaw — Personal AI Agent  ");
console.log("=================================");
console.log(`LLM: Groq (${config.groq.model}) → Gemini fallback`);
console.log(`Allowed users: ${config.telegram.allowedUserIds.join(", ")}`);
console.log(`DB: ${config.db.path}`);
console.log(`Max iterations: ${config.agent.maxIterations}`);
console.log("=================================");

const bot = createBot();

process.once("SIGINT", () => {
  console.log("\n[Agent] Shutting down gracefully...");
  bot.stop("SIGINT");
});

process.once("SIGTERM", () => {
  console.log("\n[Agent] Shutting down gracefully...");
  bot.stop("SIGTERM");
});

console.log("[Agent] Starting Telegram bot (long polling)...");

bot.start({
  onStart(info) {
    console.log(`[Agent] Bot is running as @${info.username}`);
    console.log("[Agent] Ready to receive messages.");
  },
}).catch((err) => {
  console.error("[Agent] Fatal error:", err);
  process.exit(1);
});
