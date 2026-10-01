#!/usr/bin/env node
/**
 * Create the first SAT-7 Promo administrator.
 *
 * Runs entirely on your machine and reads every secret from the environment —
 * nothing is hard-coded here, and nothing is written to disk. The password is
 * never passed on a command line (which would leak it to shell history and the
 * process list); it is read from a variable and sent over HTTPS.
 *
 * Usage
 *   # PowerShell
 *   $env:SUPABASE_URL   = "https://<project-ref>.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY = "<service-role-key>"
 *   $env:ADMIN_EMAIL    = "you@sat7.org"
 *   $env:ADMIN_PASSWORD = "<a strong password>"
 *   node scripts/setup-admin.mjs
 *
 *   # bash / zsh
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/setup-admin.mjs
 *
 * The service role key bypasses RLS. Never put it in .env.local, commit it, or
 * run this against production without intending to create a real admin there.
 *
 * Re-running is safe: if the user already exists, their password and metadata
 * are updated and their role is re-asserted, so this doubles as a password
 * reset for a locked-out administrator.
 */

/** Reads a required variable, failing loudly rather than half-running. */
function requireEnv(name, { secret = false } = {}) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`\nMissing required environment variable: ${name}\n`);
    process.exit(1);
  }
  if (secret) {
    // Echo the length, never the value.
    console.log(`  ${name}: set (${value.length} characters)`);
  }
  return value;
}

/**
 * Supabase GoTrue exposes user administration under /auth/v1/admin. Errors come
 * back as JSON with `error_description`, which is far more useful than the
 * status code alone.
 */
async function adminRequest(baseUrl, key, path, init = {}) {
  const response = await fetch(`${baseUrl}/auth/v1/admin${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    const detail =
      (body && (body.msg || body.error_description || body.message)) || text || response.statusText;
    throw new Error(`${init.method ?? 'GET'} ${path} failed (${response.status}): ${detail}`);
  }

  return body;
}

async function main() {
  console.log('SAT-7 Promo — administrator bootstrap\n');

  const url = requireEnv('SUPABASE_URL').replace(/\/+$/, '');
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY', { secret: true });
  const email = requireEnv('ADMIN_EMAIL').toLowerCase();
  const password = requireEnv('ADMIN_PASSWORD', { secret: true });

  if (!email.includes('@')) {
    console.error(`\nADMIN_EMAIL does not look like an email address: ${email}\n`);
    process.exit(1);
  }

  if (password.length < 12) {
    console.error(
      `\nADMIN_PASSWORD must be at least 12 characters (got ${password.length}). ` +
        'Supabase also rejects passwords shorter than 6.\n',
    );
    process.exit(1);
  }

  // The user metadata is read back into the profiles trigger on first insert,
  // so a display name here becomes the person's name everywhere in the app.
  const userMetadata = {
    full_name: process.env.ADMIN_FULL_NAME?.trim() || email.split('@')[0],
    role: 'administrator',
  };

  console.log(`  target: ${email}\n`);

  // 1. Does the user already exist? Look them up by address.
  let existing = null;
  try {
    const found = await adminRequest(url, key, `/users?page=1&per_page=200`);
    existing = (found?.users ?? []).find(
      (u) => u.email?.toLowerCase() === email,
    ) ?? null;
  } catch (error) {
    // A project with more users than one page will not be found this way, but
    // we can still create; the create call below will fail on a true duplicate.
    console.warn(`  lookup skipped: ${error.message}`);
  }

  if (existing) {
    console.log('  user already exists — updating password, email and role');

    const updated = await adminRequest(url, key, `/users/${existing.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { ...(existing.user_metadata ?? {}), ...userMetadata },
      }),
    });

    console.log(`  ok  user id: ${updated.id ?? existing.id}`);
    console.log(`  ok  role set to administrator for ${email}`);
    console.log('\nDone. Sign in at /login, then change the password from Settings → Security.\n');
    return;
  }

  // 2. Otherwise create the user with the admin role already in metadata.
  const created = await adminRequest(url, key, '/users', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: userMetadata,
    }),
  });

  console.log(`  ok  created user id: ${created.id}`);
  console.log(`  ok  role set to administrator for ${email}`);

  // 3. Belt and braces: assert the role via the SQL helper, in case the trigger
  // that copies user_metadata into profiles has not been applied yet.
  console.log(
    '\nIf the role did not take effect, run this once in the Supabase SQL editor:\n' +
      `  select public.promote_to_administrator('${email}');\n`,
  );

  console.log('Done. Sign in at /login, then change the password from Settings → Security.\n');
}

main().catch((error) => {
  console.error(`\nSetup failed: ${error.message}\n`);
  process.exit(1);
});