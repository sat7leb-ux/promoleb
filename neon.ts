import { defineConfig } from "@neon/config/v1";

/**
 * Neon infrastructure-as-code.
 *
 * `defineConfig({})` provisions Postgres and nothing else, which is correct for
 * a plain SQL workload but leaves this app without its three dependencies:
 *
 *  - `dataApi` — a PostgREST-compatible HTTP interface. This app reads through
 *    a Supabase client (`.from('promo_requests').select(...)`), so the Data API
 *    is the migration path that keeps those 17 query modules working instead of
 *    forcing a rewrite to hand-written SQL.
 *  - `auth` — Neon Auth (managed Better Auth), replacing Supabase Auth. The
 *    Data API verifies requests with Neon Auth by default, so `dataApi` requires
 *    it; declaring both is what makes this config typecheck.
 *  - `buckets` — S3-compatible Object Storage for request attachments,
 *    replacing the Supabase Storage bucket.
 */
export default defineConfig({
  auth: true,
  dataApi: true,
  buckets: {
    // Private, like the `promo-files` bucket this replaces. Downloads are
    // short-lived signed URLs minted server-side, never public objects.
    "promo-files": {
      access: "private",
    },
  },
});