#!/usr/bin/env node
/**
 * Apply the SQL migrations to the Neon database.
 *
 * Reads the numbered files from `supabase/migrations` and executes them in
 * order against `DATABASE_URL`. Deliberately a script rather than an inline
 * command: the SQL never has to pass through an agent's context, which is the
 * whole point — these files are long, and copying them by hand is both slow and
 * a chance to introduce errors.
 *
 * Usage
 *   node scripts/migrate.mjs              # apply everything pending
 *   node scripts/migrate.mjs --status     # list applied vs pending, change nothing
 *
 * 008 is skipped on purpose: it creates `storage.buckets` / `storage.objects`,
 * which are Supabase Storage objects. Neon has Object Storage (S3) instead, and
 * `public.attachments` already stores the `storage_path` we need.
 */

import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const MIGRATIONS = join(root, 'supabase', 'migrations');

/**
 * Loads `.env.local` so the script runs without the caller wiring up env vars.
 * A real environment variable always wins, so CI can override the local file.
 */
async function loadEnvFile() {
  try {
    const raw = await readFile(join(root, '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
      }
    }
  } catch {
    // No local env file — rely on the real environment.
  }
}

/** Not applicable to Neon — see the note above. */
const SKIP = new Set(['20260101000008_storage.sql']);

/**
 * Statements are split on semicolons that end a line, which is enough for these
 * files: they contain no semicolons inside string literals or function bodies
 * beyond the plpgsql `$$ ... $$` blocks, and those are terminated by `$$;` on
 * its own line.
 */
function splitStatements(sql) {
  const out = [];
  let buf = '';
  let inDollar = false;

  for (const line of sql.split('\n')) {
    if (line.includes('$$')) inDollar = !inDollar;
    buf += line + '\n';
    if (!inDollar && line.trimEnd().endsWith(';')) {
      const stmt = buf.trim();
      if (stmt) out.push(stmt);
      buf = '';
    }
  }
  const tail = buf.trim();
  if (tail) out.push(tail);
  return out;
}

async function main() {
  await loadEnvFile();
  const statusOnly = process.argv.includes('--status');
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Run `neon env pull` first.');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Track what has run, so re-running is safe.
  await client.query(`
    create table if not exists public._migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const files = (await readdir(MIGRATIONS))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const { rows } = await client.query('select name from public._migrations');
  const applied = new Set(rows.map((r) => r.name));

  const pending = files.filter((f) => !applied.has(f) && !SKIP.has(f));

  if (statusOnly) {
    for (const f of files) {
      const state = SKIP.has(f) ? 'SKIP (Supabase-only)' : applied.has(f) ? 'applied' : 'PENDING';
      console.log(`  ${state.padEnd(20)} ${f}`);
    }
    await client.end();
    return;
  }

  if (pending.length === 0) {
    console.log('Nothing pending.');
    await client.end();
    return;
  }

  for (const file of pending) {
    const sql = await readFile(join(MIGRATIONS, file), 'utf8');
    const statements = splitStatements(sql);
    console.log(`\n${file} (${statements.length} statements)`);

    for (const [i, stmt] of statements.entries()) {
      const label = stmt.split('\n')[0].slice(0, 72);
      try {
        await client.query(stmt);
        console.log(`  ${String(i + 1).padStart(3)}/  ${statements.length}  ok    ${label}`);
      } catch (error) {
        // Report the exact statement and stop, leaving earlier files applied.
        console.error(`  ${String(i + 1).padStart(3)}/  ${statements.length}  FAIL  ${label}`);
        console.error(`       ${error.message}`);
        await client.end();
        process.exit(1);
      }
    }

    await client.query('insert into public._migrations (name) values ($1) on conflict do nothing', [
      file,
    ]);
    console.log(`  -> applied ${file}`);
  }

  await client.end();
  console.log('\nAll pending migrations applied.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});