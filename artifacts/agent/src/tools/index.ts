export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required: string[];
  };
  execute(args: Record<string, unknown>, userId: number): Promise<string>;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  result: string;
  isError: boolean;
}

const getCurrentTime: ToolDefinition = {
  name: "get_current_time",
  description:
    "Returns the current date and time in ISO 8601 format, along with the day of the week and timezone information.",
  parameters: {
    type: "object",
    properties: {
      timezone: {
        type: "string",
        description:
          "Optional IANA timezone name (e.g. 'America/New_York', 'Europe/London'). Defaults to UTC.",
      },
    },
    required: [],
  },
  async execute(args) {
    const tz = (args["timezone"] as string | undefined) || "UTC";
    const now = new Date();
    try {
      const formatted = now.toLocaleString("en-US", {
        timeZone: tz,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      const iso = now.toISOString();
      return `Current time: ${formatted} (${tz})\nISO 8601: ${iso}`;
    } catch {
      const formatted = now.toUTCString();
      return `Current time: ${formatted} (UTC)\nISO 8601: ${now.toISOString()}\nNote: Timezone '${tz}' was not recognized, defaulted to UTC.`;
    }
  },
};

const rememberFact: ToolDefinition = {
  name: "remember_fact",
  description:
    "Store a piece of information in persistent memory. Use this to remember things the user tells you for future conversations.",
  parameters: {
    type: "object",
    properties: {
      key: {
        type: "string",
        description: "A short identifier for what is being stored (e.g. 'user_name', 'preferred_language')",
      },
      value: {
        type: "string",
        description: "The information to store",
      },
    },
    required: ["key", "value"],
  },
  async execute(args, userId) {
    const { memoryStore } = await import("../memory/db.js");
    const key = args["key"] as string;
    const value = args["value"] as string;
    memoryStore.set(userId, key, value);
    return `Remembered: ${key} = ${value}`;
  },
};

const recallFact: ToolDefinition = {
  name: "recall_fact",
  description:
    "Retrieve a previously stored piece of information from persistent memory.",
  parameters: {
    type: "object",
    properties: {
      key: {
        type: "string",
        description: "The identifier of the information to retrieve",
      },
    },
    required: ["key"],
  },
  async execute(args, userId) {
    const { memoryStore } = await import("../memory/db.js");
    const key = args["key"] as string;
    const value = memoryStore.get(userId, key);
    if (value === null) {
      return `No memory found for key: ${key}`;
    }
    return `${key} = ${value}`;
  },
};

const listMemory: ToolDefinition = {
  name: "list_memory",
  description: "List all facts stored in persistent memory for the current user.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  async execute(_args, userId) {
    const { memoryStore } = await import("../memory/db.js");
    const all = memoryStore.getAll(userId);
    const entries = Object.entries(all);
    if (entries.length === 0) {
      return "No facts stored in memory yet.";
    }
    return entries.map(([k, v]) => `${k}: ${v}`).join("\n");
  },
};

export const tools: ToolDefinition[] = [
  getCurrentTime,
  rememberFact,
  recallFact,
  listMemory,
];

export const toolMap: Map<string, ToolDefinition> = new Map(
  tools.map((t) => [t.name, t])
);

export async function executeTool(
  call: ToolCall,
  userId: number
): Promise<ToolResult> {
  const tool = toolMap.get(call.name);
  if (!tool) {
    return {
      toolCallId: call.id,
      name: call.name,
      result: `Unknown tool: ${call.name}`,
      isError: true,
    };
  }
  try {
    const result = await tool.execute(call.args, userId);
    return { toolCallId: call.id, name: call.name, result, isError: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      toolCallId: call.id,
      name: call.name,
      result: `Tool error: ${msg}`,
      isError: true,
    };
  }
}
