/**
 * Environment variable access, validated once at module load.
 *
 * Keeping this in one place means a missing variable produces a single clear
 * error instead of an `undefined is not an object` somewhere deep in a query.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Copy .env.example to .env.local and fill in your Supabase credentials.`,
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== '' ? value : fallback;
}

export const env = {
  get supabaseUrl() {
    return required('NEXT_PUBLIC_SUPABASE_URL');
  },
  get supabaseAnonKey() {
    return required('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  },
  /** Server-only. Throws if accidentally reached from a client component. */
  get supabaseServiceRoleKey() {
    return required('SUPABASE_SERVICE_ROLE_KEY');
  },
  get siteUrl() {
    return optional('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000').replace(/\/$/, '');
  },
  get isProduction() {
    return process.env.NODE_ENV === 'production';
  },
  get isConfigured() {
    return Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  },
};

export function assertServerOnly(): void {
  if (typeof window !== 'undefined') {
    throw new Error('This function may only be called on the server.');
  }
}