#!/usr/bin/env node
/**
 * Apply local migration chunks to a remote Supabase project via Management API.
 * Requires: SUPABASE_ACCESS_TOKEN (sbp_...) in env
 * Usage: SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/apply-remote-migrations.mjs
 */
import fs from "node:fs";
import path from "node:path";

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "ucagtbxubealhpkpgwzq";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const CHUNKS_DIR = path.join(process.cwd(), "supabase/.temp/migration-chunks");

if (!TOKEN) {
  console.error("Missing SUPABASE_ACCESS_TOKEN (personal access token from https://supabase.com/dashboard/account/tokens)");
  process.exit(1);
}

const chunkFiles = fs
  .readdirSync(CHUNKS_DIR)
  .filter((f) => f.endsWith(".json"))
  .sort();

async function runQuery(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`${res.status} ${body}`);
  }
  return body;
}

for (const jsonFile of chunkFiles) {
  const meta = JSON.parse(fs.readFileSync(path.join(CHUNKS_DIR, jsonFile), "utf8"));
  const sql = fs.readFileSync(path.join(CHUNKS_DIR, jsonFile.replace(".json", ".sql")), "utf8");
  process.stdout.write(`Applying ${jsonFile} (${meta.fileCount} files, ${Math.round(sql.length / 1024)}KB)... `);
  try {
    await runQuery(sql);
    console.log("OK");
  } catch (err) {
    console.log("FAILED");
    console.error(err.message);
    process.exit(1);
  }
}

console.log(`Done. Applied ${chunkFiles.length} chunks.`);
