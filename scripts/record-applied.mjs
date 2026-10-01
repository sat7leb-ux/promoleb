// One-off: record the migrations that were applied by hand via the Neon MCP
// tools (and patched for Neon), so scripts/migrate.mjs does not try to re-run
// them. 002 in particular cannot be re-run — its tables already exist and its
// auth.users reference was rewritten to neon_auth.user.
import { readFileSync } from 'node:fs';
import pg from 'pg';

const envs = {};
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) envs[m[1]] = m[2].trim().replace(/^"|"$/g, '');
}

const client = new pg.Client({
  connectionString: envs.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const already = [
  '20260101000001_extensions_and_enums.sql',
  '20260101000002_core_tables.sql',
  '20260101000003_promo_requests.sql',
];

for (const name of already) {
  await client.query(
    'insert into public._migrations (name) values ($1) on conflict (name) do nothing',
    [name],
  );
}

const { rows } = await client.query('select name from public._migrations order by name');
console.log('recorded: ' + rows.map((r) => r.name.slice(14, 16)).join(', '));

await client.end();