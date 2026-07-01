/**
 * Phase 0 Graphify setup: apply migration (if missing), enable flags, run backfill.
 * Usage: node scripts/phase0-graphify-setup.mjs
 * Requires: SUPABASE_SERVICE_ROLE_KEY env var (or pass as first arg)
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://tjkqvbxtziheggurtvcz.supabase.co'

function getServiceRoleKey() {
  if (process.argv[2]) return process.argv[2]
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY
  try {
    const out = execSync('npx supabase projects api-keys --project-ref tjkqvbxtziheggurtvcz -o json', {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const jsonStart = out.indexOf('[')
    const jsonEnd = out.lastIndexOf(']')
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON in api-keys output')
    const keys = JSON.parse(out.slice(jsonStart, jsonEnd + 1))
    const service = keys.find((k) => k.name === 'service_role' || k.id === 'service_role')
    if (service?.api_key) return service.api_key
  } catch {
    /* fall through */
  }
  throw new Error('Set SUPABASE_SERVICE_ROLE_KEY or pass service role key as first argument')
}

const serviceRoleKey = getServiceRoleKey()
const supabase = createClient(SUPABASE_URL, serviceRoleKey)

async function tableExists(table) {
  const { error } = await supabase.from(table).select('id').limit(1)
  if (!error) return true
  if (error.code === '42P01' || error.message?.includes('does not exist')) return false
  throw error
}

async function rpcExists() {
  const { error } = await supabase.rpc('admin_exec_sql', { sql_content: 'SELECT 1' })
  if (!error) return true
  if (error.code === 'PGRST202' || error.message?.includes('Could not find the function')) return false
  throw error
}

async function applyMigrationSql() {
  const sqlPath = join(projectRoot, 'supabase/migrations/20260629120000_graphify_core.sql')
  const sql = readFileSync(sqlPath, 'utf8')
  const { data, error } = await supabase.rpc('admin_exec_sql', { sql_content: sql })
  if (error) throw error
  if (data && data.success === false) {
    throw new Error(data.error || 'admin_exec_sql failed')
  }
  console.log('✓ Graphify migration SQL applied')
}

async function markMigrationApplied() {
  try {
    execSync('npx supabase migration repair --status applied 20260629120000', {
      cwd: projectRoot,
      stdio: 'inherit',
    })
    console.log('✓ Migration history marked applied (20260629120000)')
  } catch (e) {
    console.warn('⚠ Could not mark migration in history (run manually if needed)')
  }
}

async function enableFlags() {
  const { error: flagError } = await supabase.from('app_config').upsert(
    {
      key: 'features.enableGraphify',
      value: true,
      category: 'features',
      description: 'Enable Graphify knowledge graph and hybrid retrieval',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  )
  if (flagError) throw flagError
  console.log('✓ features.enableGraphify = true')

  const { error: configError } = await supabase
    .from('graphify_config')
    .update({ enabled: true, updated_at: new Date().toISOString() })
    .eq('tenant_id', '00000000-0000-0000-0000-000000000001')
  if (configError) throw configError
  console.log('✓ graphify_config.enabled = true')

  const { error: moduleError } = await supabase
    .from('app_modules')
    .update({ is_active: true })
    .eq('slug', 'graphify')
  if (moduleError) {
    console.warn('⚠ app_modules graphify:', moduleError.message)
  } else {
    console.log('✓ app_modules graphify active')
  }
}

async function runBackfill() {
  const url = `${SUPABASE_URL}/functions/v1/graphify-backfill`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120_000)

  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: '{}',
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(body.error || body.message || `Backfill failed (${res.status}): ${JSON.stringify(body)}`)
    }
    if (body.error) {
      throw new Error(body.error)
    }
    console.log('✓ Backfill completed:', JSON.stringify({
      entities_synced: body.entities_synced,
      relationships_synced: body.relationships_synced,
      errors: body.errors?.length ?? 0,
    }))
  } catch (err) {
    if (err.name === 'AbortError') {
      const { count } = await supabase.from('graph_entities').select('id', { count: 'exact', head: true })
      if ((count ?? 0) > 0) {
        console.log(`⚠ Backfill still running server-side (timeout). Entities so far: ${count}`)
        return
      }
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

async function smokeTest() {
  const [entities, relationships] = await Promise.all([
    supabase.from('graph_entities').select('id', { count: 'exact', head: true }),
    supabase.from('graph_relationships').select('id', { count: 'exact', head: true }),
  ])
  if (entities.error) throw entities.error
  if (relationships.error) throw relationships.error
  console.log('✓ Smoke test:', JSON.stringify({
    entity_count: entities.count ?? 0,
    relationship_count: relationships.count ?? 0,
  }))
}

async function main() {
  console.log('Graphify Phase 0 setup\n')

  const exists = await tableExists('graph_entities')
  if (exists) {
    console.log('✓ graph_entities table already exists')
  } else {
    console.log('graph_entities missing — applying migration...')
    const hasRpc = await rpcExists()
    if (!hasRpc) {
      console.error('\n✗ admin_exec_sql RPC not found on remote.')
      console.error('  Run supabase/migrations/RUN_IF_graphify_MISSING.sql in Supabase SQL Editor first,')
      console.error('  or apply migration 20260202_admin_exec_sql.sql, then re-run this script.')
      process.exit(1)
    }
    await applyMigrationSql()
    await markMigrationApplied()
  }

  await enableFlags()
  await runBackfill()
  await smokeTest()

  console.log('\nPhase 0 complete. Open /graphify/search and /admin/graphify to verify.')
}

main().catch((err) => {
  console.error('\n✗ Phase 0 failed:', err.message || err)
  process.exit(1)
})
