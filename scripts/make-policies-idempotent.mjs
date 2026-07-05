import fs from "fs";
import path from "path";

const dir = "supabase/migrations";
let changed = 0;

const createPolicyRegex =
  /CREATE POLICY "([^"]+)"\s+ON\s+([^\s\n]+)/g;

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, "utf8");
  const original = content;

  content = content.replace(createPolicyRegex, (match, policyName, tableName, offset) => {
    const before = content.slice(Math.max(0, offset - 120), offset);
    if (before.includes(`DROP POLICY IF EXISTS "${policyName}" ON ${tableName}`)) {
      return match;
    }
    return `DROP POLICY IF EXISTS "${policyName}" ON ${tableName};\n${match}`;
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    changed++;
  }
}

console.log(`Added DROP POLICY guards in ${changed} files`);
