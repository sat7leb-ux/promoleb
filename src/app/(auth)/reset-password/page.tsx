import type { Metadata } from 'next';
import { ResetPasswordForm } from './reset-password-form';

export const metadata: Metadata = { title: 'Set a new password' };

/**
 * Reached from the link in the reset email. Supabase puts the recovery
 * credentials in the URL hash, which the SSR client picks up automatically.
 */
export default function ResetPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
        <p className="text-sm text-muted-foreground">
          Choose a strong password you have not used before.
        </p>
      </div>

      <ResetPasswordForm />
    </div>
  );
}