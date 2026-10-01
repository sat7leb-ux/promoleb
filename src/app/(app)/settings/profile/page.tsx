import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { ProfileSettingsForm } from '@/components/settings/profile-settings-form';

export const metadata: Metadata = { title: 'My profile' };

export default async function ProfileSettingsPage() {
  const session = await requireUser();

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">My profile</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          How you appear across requests, shifts and the activity log.
        </p>
      </div>

      <ProfileSettingsForm profile={session.profile} />
    </section>
  );
}