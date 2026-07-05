#!/usr/bin/env bash
set -euo pipefail

# Creates demo admin in Supabase Auth (requires service role key).
# After running, apply migration 20260705120000_hackathon_admin_seed.sql for profile + role.

cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

PROJECT_REF="${VITE_SUPABASE_PROJECT_ID:-ucagtbxubealhpkpgwzq}"
SUPABASE_URL="${VITE_SUPABASE_URL:-https://${PROJECT_REF}.supabase.co}"
EMAIL="${HACKATHON_ADMIN_EMAIL:-ceo@collabai.software}"
PASSWORD="${HACKATHON_ADMIN_PASSWORD:-Demo@123}"

if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" || "${SUPABASE_SERVICE_ROLE_KEY}" == "YOUR_SERVICE_ROLE_KEY_HERE" ]]; then
  echo "Set SUPABASE_SERVICE_ROLE_KEY in .env (Dashboard → Settings → API → service_role)."
  echo "Or create the user manually in Dashboard → Authentication → Add user:"
  echo "  email: ${EMAIL}"
  echo "  password: ${PASSWORD}"
  exit 1
fi

echo "Creating auth user ${EMAIL} on ${PROJECT_REF}..."
curl -sS -X POST "${SUPABASE_URL}/auth/v1/admin/users" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "$(node -e "
    console.log(JSON.stringify({
      email: process.argv[1],
      password: process.argv[2],
      email_confirm: true,
      user_metadata: { full_name: 'Demo Admin' }
    }))
  " "${EMAIL}" "${PASSWORD}")" | node -e "
    let d=''; process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      const j=JSON.parse(d);
      if (j.id) console.log('Created user:', j.id);
      else if (j.msg?.includes('already') || j.message?.includes('already')) console.log('User may already exist:', d);
      else { console.error(d); process.exit(1); }
    })"

echo "Run: npm run migrations:run  (or apply 20260705120000_hackathon_admin_seed.sql) to seed profile + admin role."
