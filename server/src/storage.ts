import { appendFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { AuguryReading } from "./types.js";

const LOG_DIR = join(import.meta.dir, "../../server/logs");
const LOG_FILE = join(LOG_DIR, "readings.jsonl");

export function persistReading(reading: AuguryReading): void {
  if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
  appendFileSync(LOG_FILE, JSON.stringify(reading) + "\n");
}

export function loadRecentReadings(limit: number = 20): AuguryReading[] {
  if (!existsSync(LOG_FILE)) return [];

  try {
    const content = readFileSync(LOG_FILE, "utf8");
    const lines = content.trim().split("\n").filter(Boolean);
    const readings: AuguryReading[] = [];

    // Take last N lines
    const start = Math.max(0, lines.length - limit);
    for (let i = start; i < lines.length; i++) {
      try {
        readings.push(JSON.parse(lines[i]) as AuguryReading);
      } catch {
        // Skip malformed lines
      }
    }

    return readings.reverse(); // Most recent first
  } catch {
    return [];
  }
}
