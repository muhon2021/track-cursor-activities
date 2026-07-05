#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-ucagtbxubealhpkpgwzq}"
KEEP=(csa-ingest csa-reports csa-generate-insights)

cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

echo "Listing deployed functions on ${PROJECT_REF}..."
DEPLOYED_JSON="$(npx supabase functions list --project-ref "$PROJECT_REF" -o json)"
DEPLOYED=()
while IFS= read -r slug; do
  [[ -n "$slug" ]] && DEPLOYED+=("$slug")
done < <(
  node -e "
    const slugs = JSON.parse(process.argv[1]).map(f => f.slug || f.name);
    slugs.forEach(s => console.log(s));
  " "$DEPLOYED_JSON"
)

echo "Found ${#DEPLOYED[@]} deployed functions."

is_kept() {
  local slug="$1"
  for k in "${KEEP[@]}"; do
    [[ "$slug" == "$k" ]] && return 0
  done
  return 1
}

for slug in "${DEPLOYED[@]}"; do
  if is_kept "$slug"; then
    echo "Keeping: $slug"
    continue
  fi
  echo "Deleting: $slug"
  npx supabase functions delete "$slug" --project-ref "$PROJECT_REF" --yes || echo "  (delete failed, continuing)"
  sleep 1
done

echo "Deploying CSA functions..."
npx supabase functions deploy "${KEEP[@]}" \
  --project-ref "$PROJECT_REF" \
  --use-api \
  --yes

echo "Done. Deployed CSA functions:"
npx supabase functions list --project-ref "$PROJECT_REF" -o json \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{JSON.parse(d).forEach(f=>console.log(' -',f.slug||f.name))})"
