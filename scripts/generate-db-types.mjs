#!/usr/bin/env node
/**
 * Regenerate `src/types/database.ts` from the live Supabase schema.
 *
 * The types in that file are hand-written and load-bearing: the app's queries
 * depend on the embedded-resource shapes they declare. This script is the
 * supported way to refresh them after a schema change, so nobody has to keep
 * them in sync by hand.
 *
 * Usage
 *   $env:SUPABASE_PROJECT_ID = "<project-ref>"
 *   $env:SUPABASE_DB_PASSWORD = "<database password>"
 *   npx supabase gen types typescript --project-id $env:SUPABASE_PROJECT_ID > src/types/database.generated.ts
 *   npm run db:types
 *
 * The generated file is written beside the hand-written one on purpose: review
 * the diff, then fold the changes in. Auto-overwriting would silently change
 * every query's inferred type, which is exactly the kind of change that should
 * be looked at rather than accepted.
 *
 * Requires the Supabase CLI (`npm i -g supabase`) and a linked project.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const GENERATED = join(root, 'src', 'types', 'database.generated.ts');
const TARGET = join(root, 'src', 'types', 'database.ts');

const HEADER = `/**
 * Hand-written Supabase types.
 *
 * DO NOT hand-edit the table and row definitions below without also running
 * \`npm run db:types\` after applying a migration.
 *
 * Two conventions here are load-bearing, not stylistic:
 *
 *  1. Row types are declared with \`type\`, never \`interface\`. An interface has
 *     no implicit index signature, so it fails the SDK's \`GenericSchema\` check
 *     and every query silently collapses to \`never\`. \`type\` aliases are
 *     assignable to the index signature the SDK needs.
 *
 *  2. Every relationship includes its \`Relationships\` array. That array is what
 *     lets the SDK infer embedded resources from a \`select()\`, so dropping it
 *     turns \`request.channel.name\` into a type error.
 */
`;

async function main() {
  let generated;

  try {
    generated = await readFile(GENERATED, 'utf8');
  } catch {
    console.error(
      `Could not read ${GENERATED}.\n\n` +
        'Generate it first:\n' +
        '  npx supabase gen types typescript --project-id <project-ref> --schema public\n',
    );
    process.exit(1);
  }

  if (!generated.includes('export type Database')) {
    console.error(
      `${GENERATED} does not look like generated Supabase types ` +
        '(no `export type Database`). Refusing to overwrite anything.',
    );
    process.exit(1);
  }

  let current = '';
  try {
    current = await readFile(TARGET, 'utf8');
  } catch {
    // Target missing means this is a first run; the write below creates it.
  }

  const body = generated.slice(generated.indexOf('export type Database'));
  const next = `${HEADER}\n${body.trimEnd()}\n`;

  if (current === next) {
    console.log('src/types/database.ts is already up to date.');
    return;
  }

  if (current) {
    // Keep the existing file recoverable rather than clobbering it outright.
    await writeFile(`${TARGET}.bak`, current, 'utf8');
    console.log('Wrote a backup to src/types/database.ts.bak');
  }

  await writeFile(TARGET, next, 'utf8');
  console.log('Updated src/types/database.ts.');
  console.log('Run `npm run typecheck` — the generated row shapes may not match what the queries expect.');
}

main().catch((error) => {
  console.error(`Failed: ${error.message}`);
  process.exit(1);
});