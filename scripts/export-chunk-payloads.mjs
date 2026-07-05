#!/usr/bin/env node
/**
 * Apply migration chunks using Supabase MCP apply_migration via stdin JSON lines.
 * Run from repo root. Agent feeds each line to MCP apply_migration.
 * Usage: node scripts/export-chunk-payloads.mjs > /tmp/chunks.ndjson
 */
import fs from "node:fs";
import path from "node:path";

const PROJECT_ID = "ucagtbxubealhpkpgwzq";
const dir = path.join(process.cwd(), "supabase/.temp/migration-chunks");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();

for (const jsonFile of files) {
  const meta = JSON.parse(fs.readFileSync(path.join(dir, jsonFile), "utf8"));
  const sql = fs.readFileSync(path.join(dir, jsonFile.replace(".json", ".sql")), "utf8");
  const name = meta.name.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 120);
  process.stdout.write(JSON.stringify({ project_id: PROJECT_ID, name, query: sql }) + "\n");
}
