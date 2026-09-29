#!/usr/bin/env node
/**
 * VeriJob — Supabase Migration Runner
 * ------------------------------------
 * Reads all SQL files from supabase/migrations/ in order and applies them
 * directly to Supabase Cloud PostgreSQL using the service role key.
 *
 * Usage:
 *   node supabase/run-migrations.mjs
 *   # or with dotenv pre-loaded:
 *   node -r dotenv/config supabase/run-migrations.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, 'migrations');

// Load .env manually if dotenv isn't pre-loaded
try {
  const { config } = await import('dotenv');
  config({ path: resolve(__dirname, '../.env') });
} catch {
  // dotenv may not be available in all environments — env vars may already exist
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('\n❌  Missing required environment variables:');
  if (!SUPABASE_URL)              console.error('    - SUPABASE_URL');
  if (!SUPABASE_SERVICE_ROLE_KEY) console.error('    - SUPABASE_SERVICE_ROLE_KEY');
  console.error('\n   Copy .env.example → .env and fill in your Supabase credentials.\n');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Supabase client (service role — bypasses RLS)
// ---------------------------------------------------------------------------
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Migration tracking table (created inline if it doesn't exist)
// ---------------------------------------------------------------------------
const ENSURE_TRACKING_TABLE = `
CREATE TABLE IF NOT EXISTS public._migrations (
  id          SERIAL      PRIMARY KEY,
  filename    TEXT        NOT NULL UNIQUE,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getSortedMigrationFiles() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // lexicographic order — 001_, 002_, ... ensures correct sequence
  return files;
}

async function getAppliedMigrations() {
  const { data, error } = await supabase
    .from('_migrations')
    .select('filename');

  if (error) {
    // Table might not exist yet on first run — that's OK, we create it inline
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.filename));
}

async function markMigrationApplied(filename) {
  const { error } = await supabase
    .from('_migrations')
    .insert({ filename });

  if (error) {
    console.warn(`  ⚠  Could not record migration "${filename}" in tracking table: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Execute raw SQL via Supabase's postgres REST (rpc wrapper)
// NOTE: Supabase JS client doesn't expose a raw SQL executor directly.
// We use the pg REST endpoint via fetch with the service role key.
// ---------------------------------------------------------------------------
async function executeSql(sql) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ sql }),
  });

  if (!response.ok) {
    // Fallback: try the pg endpoint directly
    const pgResponse = await fetch(`${SUPABASE_URL}/pg`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    });

    if (!pgResponse.ok) {
      const text = await pgResponse.text();
      throw new Error(`SQL execution failed (${pgResponse.status}): ${text}`);
    }
    return;
  }
}

// Primary approach: Supabase SQL API (available via supabase-js v2 rpc or direct HTTP)
async function runSqlViaSupabaseApi(sql) {
  // Split multi-statement SQL into individual statements to run via rpc
  // Supabase's PostgREST doesn't support multi-statement SQL directly.
  // Instead, use the pg/sql endpoint if available, or wrap in a DO block.
  const endpoint = `${SUPABASE_URL}/rest/v1/`;

  // Use the Management API SQL endpoint (works with service_role)
  const sqlEndpoint = SUPABASE_URL.replace('.supabase.co', '.supabase.co') + '/rest/v1/rpc/exec_sql';

  // Best approach: Supabase now exposes a /sql endpoint on recent versions
  const sqlApiEndpoint = SUPABASE_URL + '/sql';

  const res = await fetch(sqlApiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[Supabase SQL API] ${res.status} — ${body}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('\n🚀  VeriJob — Supabase Migration Runner');
  console.log(`📂  Migrations directory: ${MIGRATIONS_DIR}`);
  console.log(`🔗  Target:              ${SUPABASE_URL}\n`);

  // Step 1: Ensure the migration tracking table exists
  console.log('🔧  Ensuring _migrations tracking table exists...');
  try {
    await runSqlViaSupabaseApi(ENSURE_TRACKING_TABLE);
    console.log('    ✓  _migrations table ready.\n');
  } catch (err) {
    // If the /sql endpoint isn't available, warn and continue
    // The first migration will create tables fresh
    console.warn(`    ⚠  Could not pre-create tracking table via API: ${err.message}`);
    console.warn('    ℹ  Continuing — tracking table will be created with the migration.\n');
  }

  // Step 2: Get already-applied migrations
  const applied = await getAppliedMigrations();

  // Step 3: Get all migration files
  const files = getSortedMigrationFiles();

  if (files.length === 0) {
    console.log('ℹ️   No migration files found in supabase/migrations/');
    return;
  }

  const pending = files.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log('✅  All migrations already applied. Nothing to do.\n');
    return;
  }

  console.log(`📋  Found ${files.length} migration(s), ${pending.length} pending:\n`);
  pending.forEach((f) => console.log(`    • ${f}`));
  console.log('');

  // Step 4: Apply each pending migration
  let successCount = 0;
  let failCount = 0;

  for (const file of pending) {
    const filePath = join(MIGRATIONS_DIR, file);
    const sql = readFileSync(filePath, 'utf-8');

    process.stdout.write(`⏳  Applying ${file}...`);

    try {
      await runSqlViaSupabaseApi(sql);
      await markMigrationApplied(file);
      console.log(' ✅');
      successCount++;
    } catch (err) {
      console.log(` ❌\n`);
      console.error(`    Error: ${err.message}\n`);
      failCount++;

      // Stop on first failure to avoid cascading errors
      console.error('🛑  Migration stopped due to error. Fix the issue and re-run.\n');
      process.exit(1);
    }
  }

  // Step 5: Summary
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`✅  ${successCount} migration(s) applied successfully.`);
  if (failCount > 0) {
    console.log(`❌  ${failCount} migration(s) failed.`);
  }
  console.log(`${'─'.repeat(50)}\n`);
}

main().catch((err) => {
  console.error('\n💥  Unexpected error:', err.message);
  process.exit(1);
});
