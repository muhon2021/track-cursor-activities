#!/usr/bin/env node
/**
 * SJ Control Tower — Cursor AI Productivity Audit ingest hook (fail-open).
 *
 * Install (any machine, any repo):
 *   ~/.cursor/hooks.json        → points to ./hooks/csa-track.mjs
 *   ~/.cursor/hooks/csa-track.mjs
 *   ~/.cursor/dct-csa.json      → { supabase_url, ingest_token, debug? }
 */

import { readFileSync, appendFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import https from "https";
import http from "http";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PROJECT_ROOT = join(__dirname, "..", "..");

function cursorHome() {
  return process.env.CURSOR_HOME || join(homedir(), ".cursor");
}

function projectRoot() {
  return process.env.CURSOR_PROJECT_DIR || SCRIPT_PROJECT_ROOT;
}

function logFilePath() {
  const homeHooks = join(cursorHome(), "hooks", "csa-track.log");
  if (__dirname.replace(/\\/g, "/").includes("/.cursor/hooks")) {
    return homeHooks;
  }
  try {
    return join(projectRoot(), ".cursor", "hooks", "csa-track.log");
  } catch {
    return homeHooks;
  }
}

function logLine(message, level = "info") {
  if (level === "error" || process.env.CSA_DEBUG === "1") {
    try {
      const logPath = logFilePath();
      mkdirSync(dirname(logPath), { recursive: true });
      appendFileSync(logPath, `${new Date().toISOString()} [${level}] ${message}\n`);
    } catch {
      // ignore
    }
  }
}

async function readStdin() {
  if (process.stdin.isTTY) return {};

  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  const data = Buffer.concat(chunks).toString("utf8").trim();
  if (!data) return {};

  try {
    return JSON.parse(data);
  } catch {
    logLine(`stdin JSON parse failed: ${data.slice(0, 120)}`, "error");
    return {};
  }
}

function loadUserConfig() {
  const configPath = join(cursorHome(), "dct-csa.json");
  try {
    const raw = JSON.parse(readFileSync(configPath, "utf8"));
    if (raw.ingest_token && !process.env.CSA_INGEST_TOKEN) {
      process.env.CSA_INGEST_TOKEN = String(raw.ingest_token);
    }
    const url = raw.supabase_url || raw.supabaseUrl;
    if (url && !process.env.SUPABASE_URL) {
      process.env.SUPABASE_URL = String(url);
      process.env.VITE_SUPABASE_URL = String(url);
    }
    if (raw.debug === true) process.env.CSA_DEBUG = "1";
    logLine(`loaded ${configPath}`);
    return true;
  } catch {
    return false;
  }
}

function loadEnvFromDotenv() {
  const root = projectRoot();
  const candidates = [join(root, ".env"), join(SCRIPT_PROJECT_ROOT, ".env")];

  for (const envPath of candidates) {
    try {
      const content = readFileSync(envPath, "utf8");
      for (const rawLine of content.split("\n")) {
        const line = rawLine.replace(/\r$/, "").trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq <= 0) continue;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
      }
      logLine(`loaded .env from ${envPath}`);
      return true;
    } catch {
      // try next
    }
  }
  return false;
}

function resolveSessionId(payload) {
  return payload.conversation_id || payload.session_id || payload.chat_id || null;
}

function mapEvent(hookName, payload) {
  const sessionId = resolveSessionId(payload);
  if (!sessionId) {
    logLine(`hook=${hookName} missing conversation_id/session_id`, "error");
    return null;
  }

  const workspace =
    payload.workspace_roots?.[0] ||
    payload.workspace_path ||
    process.env.CURSOR_PROJECT_DIR ||
    projectRoot();
  const projectName =
    String(workspace).split(/[/\\]/).filter(Boolean).pop() || "unknown-project";

  if (hookName === "sessionStart") {
    return {
      event: "session_start",
      cursor_session_id: sessionId,
      workspace_path: workspace,
      project_name: projectName,
      user_email: payload.user_email || process.env.CURSOR_USER_EMAIL || undefined,
    };
  }

  if (hookName === "beforeSubmitPrompt") {
    const text = payload.prompt ?? payload.text ?? payload.message ?? "";
    if (!text) {
      logLine(`hook=beforeSubmitPrompt empty prompt`, "error");
      return null;
    }
    const promptText = typeof text === "string" ? text : JSON.stringify(text);
    return {
      event: "prompt",
      cursor_session_id: sessionId,
      workspace_path: workspace,
      project_name: projectName,
      user_email: payload.user_email || process.env.CURSOR_USER_EMAIL || undefined,
      prompt: {
        text: promptText,
        generation_id: payload.generation_id || undefined,
        model: payload.model || undefined,
        model_id: payload.model_id || undefined,
        model_params: Array.isArray(payload.model_params) ? payload.model_params : undefined,
        composer_mode: payload.composer_mode || undefined,
      },
    };
  }

  if (hookName === "afterAgentResponse") {
    const responseText = payload.text ?? payload.response ?? "";
    const length = typeof responseText === "string" ? responseText.length : 0;
    return {
      event: "response",
      cursor_session_id: sessionId,
      workspace_path: workspace,
      project_name: projectName,
      user_email: payload.user_email || process.env.CURSOR_USER_EMAIL || undefined,
      response: {
        text_length: length,
        model: payload.model,
        tool_calls: payload.tool_calls?.length,
      },
    };
  }

  if (hookName === "stop" || hookName === "sessionEnd") {
    return {
      event: "session_end",
      cursor_session_id: sessionId,
      user_email: payload.user_email || process.env.CURSOR_USER_EMAIL || undefined,
    };
  }

  logLine(`unmapped hook=${hookName}`, "error");
  return null;
}

function sessionEnvOutput() {
  const token = process.env.CSA_INGEST_TOKEN;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!token || !supabaseUrl) return null;
  return {
    env: {
      CSA_INGEST_TOKEN: token,
      VITE_SUPABASE_URL: supabaseUrl,
      SUPABASE_URL: supabaseUrl,
    },
  };
}

async function postIngestWithHttps(url, headers, jsonBody, timeoutMs) {
  const body = JSON.stringify(jsonBody);
  const parsed = new URL(url);
  const lib = parsed.protocol === "https:" ? https : http;

  return new Promise((resolve) => {
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method: "POST",
        headers: { ...headers, "Content-Length": Buffer.byteLength(body) },
        timeout: timeoutMs,
      },
      (res) => {
        let text = "";
        res.on("data", (chunk) => {
          text += chunk;
        });
        res.on("end", () => {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            text,
          });
        });
      },
    );
    req.on("error", (err) => {
      resolve({ ok: false, status: 0, text: err.message });
    });
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, status: 0, text: "timeout" });
    });
    req.write(body);
    req.end();
  });
}

async function postIngest(body, token, supabaseUrl) {
  const url = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/csa-ingest`;
  const payload = { ...body, timestamp: new Date().toISOString() };
  const headers = {
    "Content-Type": "application/json",
    "x-csa-ingest-token": token,
  };
  const timeoutMs = 8000;

  try {
    let ok = false;
    let status = 0;
    let text = "";

    if (typeof fetch === "function") {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        text = await res.text();
        ok = res.ok;
        status = res.status;
      } finally {
        clearTimeout(timer);
      }
    } else {
      const res = await postIngestWithHttps(url, headers, payload, timeoutMs);
      ok = res.ok;
      status = res.status;
      text = res.text;
    }

    if (!ok) {
      logLine(`ingest ${body.event} FAILED status=${status} body=${text.slice(0, 300)}`, "error");
      return false;
    }
    logLine(`ingest ${body.event} ok session=${body.cursor_session_id} project=${body.project_name || "?"}`);
    return true;
  } catch (err) {
    logLine(
      `ingest ${body.event} error: ${err instanceof Error ? err.message : String(err)}`,
      "error",
    );
    return false;
  }
}

async function main() {
  loadUserConfig();
  loadEnvFromDotenv();

  const payload = await readStdin();
  const hookName =
    payload.hook_event_name ||
    process.env.CURSOR_HOOK_EVENT ||
    process.argv[2] ||
    "unknown";

  if (hookName === "sessionStart") {
    const out = sessionEnvOutput();
    if (out) {
      process.stdout.write(`${JSON.stringify(out)}\n`);
    } else {
      logLine(
        "sessionStart: missing token/url — create ~/.cursor/dct-csa.json (see DCT → Cursor Insights → Setup)",
        "error",
      );
    }
  }

  const token = process.env.CSA_INGEST_TOKEN;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";

  if (!token || !supabaseUrl) {
    logLine(`hook=${hookName} skip: token=${!!token} url=${!!supabaseUrl}`, "error");
    process.exit(0);
  }

  const body = mapEvent(hookName, payload);
  if (body && hookName !== "sessionStart") {
    await postIngest(body, token, supabaseUrl);
  }

  process.exit(0);
}

main();
