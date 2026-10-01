import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { permissionsFor } from '@/lib/auth/permissions';
import { getOrgSettings } from '@/lib/actions/settings';
import { OrgSettingsForm } from '@/components/settings/org-settings-form';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const session = await requireUser();
  const permission = permissionsFor(session.role);
  const settings = await getOrgSettings();

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">General</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Organisation-wide defaults. Individual fields on a request always override these.
        </p>
      </div>

      <OrgSettingsForm defaults={settings} canEdit={permission.canManageSettings} />

      {!permission.canManageSettings && (
        <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          You can view these settings, but only an administrator can change them.
        </p>
      )}
    </section>
  );
}