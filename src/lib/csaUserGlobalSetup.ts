/** Generate user-global Cursor hook install files (no project repo required). */

const CSA_TRACK_VERSION = "2";

export function getSupabaseIngestBaseUrl(): string {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  return url ? url.replace(/\/$/, "") : "";
}

export function buildUserHooksJson(): string {
  return JSON.stringify(
    {
      version: 1,
      hooks: {
        sessionStart: [{ command: "node ./hooks/csa-track.mjs sessionStart" }],
        beforeSubmitPrompt: [{ command: "node ./hooks/csa-track.mjs beforeSubmitPrompt" }],
        afterAgentResponse: [{ command: "node ./hooks/csa-track.mjs afterAgentResponse" }],
        stop: [{ command: "node ./hooks/csa-track.mjs stop" }],
        sessionEnd: [{ command: "node ./hooks/csa-track.mjs sessionEnd" }],
      },
    },
    null,
    2,
  );
}

export function buildDctCsaConfigJson(ingestToken: string, supabaseUrl?: string): string {
  const base = supabaseUrl || getSupabaseIngestBaseUrl();
  return JSON.stringify(
    {
      version: CSA_TRACK_VERSION,
      supabase_url: base,
      ingest_token: ingestToken,
      debug: false,
    },
    null,
    2,
  );
}

export const USER_GLOBAL_PATHS = {
  win: {
    cursorDir: "%USERPROFILE%\\.cursor",
    hooksJson: "%USERPROFILE%\\.cursor\\hooks.json",
    trackScript: "%USERPROFILE%\\.cursor\\hooks\\csa-track.mjs",
    config: "%USERPROFILE%\\.cursor\\dct-csa.json",
    log: "%USERPROFILE%\\.cursor\\hooks\\csa-track.log",
  },
  mac: {
    cursorDir: "~/.cursor",
    hooksJson: "~/.cursor/hooks.json",
    trackScript: "~/.cursor/hooks/csa-track.mjs",
    config: "~/.cursor/dct-csa.json",
    log: "~/.cursor/hooks/csa-track.log",
  },
} as const;

export function getCsaTrackDownloadUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/csa/csa-track.mjs`;
  }
  return "/csa/csa-track.mjs";
}

/** Node.js baseline for csa-track.mjs (no npm packages required). */
export const CSA_HOOK_REQUIREMENTS = {
  minNode: "14.x",
  recommendedNode: "18.x",
  notes: [
    "Uses only Node built-ins (fs, https, path) — no npm install.",
    "Hooks run via: node ./hooks/csa-track.mjs (the node on your PATH).",
    "Node 14–17 use built-in https; Node 18+ may use native fetch.",
    "Same ingest token works on every machine — copy dct-csa.json to each device.",
  ],
} as const;

export const INSTALL_FILE_INSTRUCTIONS = {
  dctCsa: {
    title: "dct-csa.json — connection config (required)",
    steps: [
      "This file must live in your Cursor user folder, not inside your project repo.",
      "Windows: In File Explorer, type %USERPROFILE%\\.cursor in the address bar and press Enter. Create the folder if it is missing, then save this file as dct-csa.json in that folder.",
      "macOS / Linux: Run mkdir -p ~/.cursor in Terminal, then save as ~/.cursor/dct-csa.json.",
      "Tip: Click Download below, then move the file into the folder above. Overwrite the old file if you are updating your token.",
    ],
  },
  hooksFolder: {
    title: "hooks folder",
    steps: [
      "Create a subfolder named hooks inside your Cursor user folder.",
      "Windows: %USERPROFILE%\\.cursor\\hooks (example: C:\\Users\\YourName\\.cursor\\hooks)",
      "macOS / Linux: ~/.cursor/hooks (example: /Users/YourName/.cursor/hooks)",
      "If the hooks folder already exists, you do not need to create it again — continue to Step 3.",
    ],
  },
  hooksJson: {
    title: "hooks.json — tells Cursor when to run the tracker (required)",
    steps: [
      "Save this file in the .cursor folder itself — the same folder that contains dct-csa.json — not inside the hooks subfolder.",
      "Windows: %USERPROFILE%\\.cursor\\hooks.json",
      "macOS / Linux: ~/.cursor/hooks.json",
      "If hooks.json already exists: open it and add the csa-track hook entries from below into the hooks object. Keep your existing hooks — do not delete them.",
      "If you do not have hooks.json yet: download or copy the full file below as a new hooks.json.",
      "Important: install CSA hooks globally (~/.cursor) OR in a project (.cursor/hooks) — not both. Running the same hook in two places double-counts every prompt.",
    ],
  },
} as const;
