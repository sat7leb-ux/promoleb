import { requireUser } from '@/lib/auth/session';
import { SettingsNav } from '@/components/settings/settings-nav';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  const isAdmin = session.role === 'administrator';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account, and the reference data every promo request depends on.
        </p>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:gap-8">
        <div className="lg:w-56 lg:shrink-0">
          <SettingsNav isAdmin={isAdmin} />
        </div>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}