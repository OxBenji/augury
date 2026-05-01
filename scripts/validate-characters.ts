/**
 * Validate all character files against the elizaOS v3 characterSchema.
 * Read-only — does not modify any files.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { validateCharacter } from "@elizaos/core";

const charDir = join(import.meta.dirname, "..", "characters");
const files = readdirSync(charDir).filter((f) => f.endsWith(".json"));

interface Result {
  file: string;
  valid: boolean;
  warnings: string[];
  errors: string[];
}

const results: Result[] = [];

for (const file of files) {
  const path = join(charDir, file);
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const result: Result = { file, valid: false, warnings: [], errors: [] };

  // Check for custom/extra fields that strict schema will reject
  const knownTopLevel = new Set([
    "id", "name", "username", "system", "templates", "bio",
    "messageExamples", "postExamples", "topics", "adjectives",
    "knowledge", "plugins", "settings", "secrets", "style",
  ]);
  for (const key of Object.keys(raw)) {
    if (!knownTopLevel.has(key)) {
      result.warnings.push(`extra field "${key}" (will be stripped or cause error in strict mode)`);
    }
  }

  // Check style sub-fields
  if (raw.style && typeof raw.style === "object") {
    const knownStyle = new Set(["all", "chat", "post"]);
    for (const key of Object.keys(raw.style)) {
      if (!knownStyle.has(key)) {
        result.warnings.push(`style.${key} is not in schema (only all/chat/post allowed)`);
      }
    }
    // Check that style values are string arrays, not plain strings
    for (const key of ["all", "chat", "post"]) {
      const val = raw.style[key];
      if (val !== undefined && !Array.isArray(val)) {
        result.errors.push(`style.${key} must be string[] but got ${typeof val}`);
      }
    }
  }

  // Check messageExamples format: must be array of arrays of {name, content}
  if (raw.messageExamples) {
    for (let i = 0; i < raw.messageExamples.length; i++) {
      const convo = raw.messageExamples[i];
      if (!Array.isArray(convo)) {
        result.errors.push(`messageExamples[${i}] must be an array`);
        continue;
      }
      for (let j = 0; j < convo.length; j++) {
        const msg = convo[j];
        if (!msg.name && msg.user) {
          result.errors.push(`messageExamples[${i}][${j}] has "user" but schema expects "name"`);
        }
        if (msg.content && typeof msg.content === "object" && msg.content.text === undefined) {
          result.warnings.push(`messageExamples[${i}][${j}].content missing "text" field`);
        }
      }
    }
  }

  // Check bio type
  if (raw.bio !== undefined) {
    if (typeof raw.bio !== "string" && !Array.isArray(raw.bio)) {
      result.errors.push(`bio must be string or string[] but got ${typeof raw.bio}`);
    }
  }

  // Run the actual validator
  const validation = validateCharacter(raw);
  if (validation.success) {
    result.valid = true;
  } else {
    result.valid = false;
    if (validation.error) {
      result.errors.push(validation.error.message);
      if (validation.error.issues) {
        for (const issue of validation.error.issues.slice(0, 5)) {
          result.errors.push(`  → ${issue.path?.join(".")}: ${issue.message}`);
        }
      }
    }
  }

  results.push(result);
}

// Print report
console.log("");
console.log("  CHARACTER COMPATIBILITY REPORT");
console.log("  ===============================");
console.log("");

let valid = 0, warned = 0, errored = 0;

for (const r of results) {
  const icon = r.errors.length > 0 ? (r.valid ? "⚠️" : "❌") : (r.warnings.length > 0 ? "⚠️" : "✅");
  if (r.errors.length > 0 && !r.valid) errored++;
  else if (r.warnings.length > 0) warned++;
  else valid++;

  console.log(`  ${icon} ${r.file} — ${r.valid ? "valid" : "INVALID"}, ${r.errors.length} errors, ${r.warnings.length} warnings`);
  for (const e of r.errors) console.log(`     ❌ ${e}`);
  for (const w of r.warnings) console.log(`     ⚠️  ${w}`);
}

console.log("");
console.log(`  Summary: ${valid}/9 clean, ${warned}/9 with warnings, ${errored}/9 with errors`);
console.log("");
