import fs from "fs";
import path from "path";

const dir = "supabase/migrations";
let changed = 0;

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, "utf8");
  const original = content;

  content = content.replace(/(?<!extensions\.)vector_cosine_ops/g, "extensions.vector_cosine_ops");
  content = content.replace(/(?<!extensions\.)vector\((\d+)\)/g, "extensions.vector($1)");
  content = content.replace(/(?<!extensions\.)vector(?=[,)])/g, "extensions.vector");

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    changed++;
  }
}

console.log(`Updated ${changed} migration files`);
