import fs from "fs";
import path from "path";

const dir = "supabase/migrations";
let changed = 0;

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, "utf8");
  if (!content.includes("<=>")) continue;

  const original = content;
  content = content.replace(
    /(LANGUAGE SQL STABLE\n)(?!SET search_path = public, extensions\n)AS \$\$/g,
    "$1SET search_path = public, extensions\nAS $$",
  );
  content = content.replace(
    /(LANGUAGE plpgsql(?:\s+SECURITY DEFINER)?\n)SET search_path = public\n/g,
    "$1SET search_path = public, extensions\n",
  );

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    changed++;
  }
}

console.log(`Updated search_path in ${changed} migration files`);
