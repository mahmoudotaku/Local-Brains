import Database from "better-sqlite3";
import path from "path";
import { config } from "../config/index.js";

export interface Message {
  id: number;
  userId: number;
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
  createdAt: string;
}

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    const dbPath = path.resolve(config.db.path);
    _db = new Database(dbPath);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'tool')),
      content TEXT NOT NULL,
      toolName TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(userId, key)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_userId ON messages(userId);
    CREATE INDEX IF NOT EXISTS idx_memory_userId ON memory(userId);
  `);

  db.prepare(`DELETE FROM messages WHERE role = 'tool'`).run();
  db.prepare(`DELETE FROM messages WHERE role = 'assistant' AND content LIKE '{%toolCalls%'`).run();
}

export const messageStore = {
  add(userId: number, role: Message["role"], content: string, toolName?: string): void {
    const db = getDb();
    db.prepare(
      `INSERT INTO messages (userId, role, content, toolName) VALUES (?, ?, ?, ?)`
    ).run(userId, role, content, toolName ?? null);
  },

  getHistory(userId: number, limit = 40): Message[] {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT * FROM messages WHERE userId = ? ORDER BY id DESC LIMIT ?`
      )
      .all(userId, limit) as Message[];
    return rows.reverse();
  },

  clear(userId: number): void {
    const db = getDb();
    db.prepare(`DELETE FROM messages WHERE userId = ?`).run(userId);
  },
};

export const memoryStore = {
  set(userId: number, key: string, value: string): void {
    const db = getDb();
    db.prepare(
      `INSERT INTO memory (userId, key, value, updatedAt)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(userId, key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`
    ).run(userId, key, value);
  },

  get(userId: number, key: string): string | null {
    const db = getDb();
    const row = db
      .prepare(`SELECT value FROM memory WHERE userId = ? AND key = ?`)
      .get(userId, key) as { value: string } | undefined;
    return row?.value ?? null;
  },

  getAll(userId: number): Record<string, string> {
    const db = getDb();
    const rows = db
      .prepare(`SELECT key, value FROM memory WHERE userId = ?`)
      .all(userId) as { key: string; value: string }[];
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  },

  delete(userId: number, key: string): void {
    const db = getDb();
    db.prepare(`DELETE FROM memory WHERE userId = ? AND key = ?`).run(userId, key);
  },
};
