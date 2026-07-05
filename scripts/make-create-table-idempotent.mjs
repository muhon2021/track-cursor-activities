import fs from "fs";
import path from "path";

const dir = "supabase/migrations";
let changed = 0;

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, "utf8");
  const original = content;

  content = content.replace(
    /CREATE TABLE (?!(IF NOT EXISTS|AS\b))((?:public\.)?[a-zA-Z_][\w]*)/g,
    "CREATE TABLE IF NOT EXISTS $1",
  );

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    changed++;
  }
}

console.log(`Added IF NOT EXISTS to CREATE TABLE in ${changed} files`);
