import fs from "fs";
import path from "path";

const dir = "supabase/migrations";
let changed = 0;

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, "utf8");

  if (!content.includes("vector(") && !content.includes("<=>")) continue;
  if (content.includes("SET search_path TO public, extensions")) continue;

  const original = content;
  content = `SET search_path TO public, extensions;\n\n${content}`;

  content = content.replace(
    /(LANGUAGE plpgsql(?:\s+SECURITY DEFINER)?\n)(?!SET search_path = public, extensions\n)AS \$\$/g,
    "$1SET search_path = public, extensions\nAS $$",
  );

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    changed++;
  }
}

console.log(`Added migration-level search_path in ${changed} files`);
