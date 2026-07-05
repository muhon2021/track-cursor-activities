import fs from "fs";
import path from "path";

const dir = "supabase/migrations";
let changed = 0;

const paramPatterns = [
  [/(\bquery_embedding)\s+extensions\.vector(\(\d+\))?/g, "$1 vector$2"],
  [/(\bp_query_embedding)\s+extensions\.vector(\(\d+\))?/g, "$1 vector$2"],
  [/(\bp_embedding)\s+extensions\.vector(\(\d+\))?/g, "$1 vector$2"],
  [/GRANT EXECUTE ON FUNCTION ([^(]+)\(extensions\.vector/g, "GRANT EXECUTE ON FUNCTION $1(vector"],
  [/,\s*extensions\.vector,/g, ", vector,"],
];

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, "utf8");
  const original = content;

  for (const [pattern, replacement] of paramPatterns) {
    content = content.replace(pattern, replacement);
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    changed++;
  }
}

console.log(`Fixed function vector signatures in ${changed} files`);
