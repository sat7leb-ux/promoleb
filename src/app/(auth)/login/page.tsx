import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string; registered?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  const params = await searchParams;
  // Only allow internal paths — an open redirect here would be a real hole.
  const next =
    params.next?.startsWith('/') && !params.next.startsWith('//') ? params.next : '/dashboard';

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Use your SAT-7 account to access the promo management system.
        </p>
      </div>

      {params.reason === 'inactive' && (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
        >
          Your account has been deactivated. Contact an administrator to restore access.
        </div>
      )}

      {params.registered === '1' && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
        >
          Your account is ready. Sign in with your email and the password you set.
        </div>
      )}

      {!env.isConfigured && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
        >
          <p className="font-medium">The application is not configured yet.</p>
          <p className="mt-1 text-rose-800/80 dark:text-rose-200/80">
            Copy <code className="rounded bg-rose-100 px-1 dark:bg-rose-900">.env.example</code> to{' '}
            <code className="rounded bg-rose-100 px-1 dark:bg-rose-900">.env.local</code> and add
            your Supabase URL and keys, then restart the dev server.
          </p>
        </div>
      )}

      <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-muted" />}>
        <LoginForm next={next} />
      </Suspense>
    </div>
  );
}