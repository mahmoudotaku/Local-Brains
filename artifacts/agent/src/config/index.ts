import "dotenv/config";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

export const config = {
  telegram: {
    botToken: requireEnv("TELEGRAM_BOT_TOKEN"),
    allowedUserIds: requireEnv("TELEGRAM_ALLOWED_USER_IDS")
      .split(",")
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => !isNaN(id)),
  },
  groq: {
    apiKey: requireEnv("GROQ_API_KEY"),
    model: optionalEnv("GROQ_MODEL", "llama-3.3-70b-versatile"),
  },
  gemini: {
    apiKey: requireEnv("GEMINI_API_KEY"),
    model: optionalEnv("GEMINI_MODEL", "gemini-1.5-flash"),
  },
  db: {
    path: optionalEnv("DB_PATH", "./memory.db"),
  },
  agent: {
    maxIterations: parseInt(optionalEnv("MAX_ITERATIONS", "10"), 10),
    systemPrompt: optionalEnv(
      "SYSTEM_PROMPT",
      `You are BaraaClaw, a personal AI assistant running locally for your owner.
You are intelligent, helpful, and security-conscious.
You have access to tools that let you take actions. Use them when appropriate.
When you have gathered enough information, provide a clear and concise final answer.
Today's date context will be provided by the get_current_time tool if needed.`
    ),
  },
} as const;
