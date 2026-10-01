import type { Metadata } from 'next';
import { PasswordChangeForm } from '@/components/settings/password-change-form';

export const metadata: Metadata = { title: 'Security' };

export default function SecuritySettingsPage() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Security</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Change your password. If you have forgotten it, use{' '}
          <a href="/forgot-password" className="font-medium underline underline-offset-4">
            password reset
          </a>{' '}
          instead.
        </p>
      </div>

      <PasswordChangeForm />
    </section>
  );
}