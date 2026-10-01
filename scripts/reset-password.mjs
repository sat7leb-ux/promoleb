#!/usr/bin/env node
/**
 * Reset an existing user's password (including an administrator's).
 *
 * Uses the Supabase Admin API, so it works when the person cannot sign in and
 * has lost access to the reset email. Like setup-admin.mjs, every secret comes
 * from the environment and nothing is written to disk.
 *
 * Usage
 *   $env:SUPABASE_URL = "https://<project-ref>.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY = "<service-role-key>"
 *   $env:RESET_EMAIL = "you@sat7.org"
 *   $env:RESET_PASSWORD = "<a strong password>"
 *   node scripts/reset-password.mjs
 *
 * This does not change the person's role, only their password.
 */

function requireEnv(name, { secret = false } = {}) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`\nMissing required environment variable: ${name}\n`);
    process.exit(1);
  }
  if (secret) console.log(`  ${name}: set (${value.length} characters)`);
  return value;
}

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
  console.log('SAT-7 Promo — password reset\n');

  const url = requireEnv('SUPABASE_URL').replace(/\/+$/, '');
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY', { secret: true });
  const email = requireEnv('RESET_EMAIL').toLowerCase();
  const password = requireEnv('RESET_PASSWORD', { secret: true });

  if (password.length < 12) {
    console.error(
      `\nRESET_PASSWORD must be at least 12 characters (got ${password.length}).\n`,
    );
    process.exit(1);
  }

  console.log(`  target: ${email}\n`);

  const found = await adminRequest(url, key, `/users?page=1&per_page=1000`);
  const user = (found?.users ?? []).find((u) => u.email?.toLowerCase() === email);

  if (!user) {
    console.error(
      `\nNo user with that address was found. Check the spelling, or run\n` +
        '  scripts/setup-admin.mjs\nto create the account.\n',
    );
    process.exit(1);
  }

  await adminRequest(url, key, `/users/${user.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      password,
      // Confirms the address so a reset cannot be used to lock someone out of a
      // mailbox the admin no longer controls.
      email_confirm: true,
    }),
  });

  console.log(`  ok  password reset for ${email}`);
  console.log(`  ok  role left unchanged (${user.role ?? 'unknown'})`);
  console.log(
    '\nDone. Sign in at /login and change the password from Settings → Security.\n',
  );
}

main().catch((error) => {
  console.error(`\nReset failed: ${error.message}\n`);
  process.exit(1);
});