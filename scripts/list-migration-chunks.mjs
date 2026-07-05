#!/usr/bin/env node
/** Print chunk SQL paths for sequential MCP apply_migration calls */
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "supabase/.temp/migration-chunks");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
for (const f of files) {
  const meta = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  const sqlFile = f.replace(".json", ".sql");
  console.log(`${f}\t${meta.name}\t${meta.fileCount}\t${fs.statSync(path.join(dir, sqlFile)).size}`);
}
