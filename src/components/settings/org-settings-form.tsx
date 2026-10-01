'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { updateOrgSettingsAction } from '@/lib/actions/settings';

/**
 * Organisation-wide settings.
 *
 * `due_soon_days` is the one setting with real teeth: it drives the
 * `due_soon` bucket on the dashboard, the amber badges in lists, and the
 * deadline sweep that raises notifications. The copy says so explicitly,
 * because changing it silently reshuffles everyone's priorities.
 */
export function OrgSettingsForm({
  defaults,
  canEdit,
}: {
  defaults: { org_name: string; due_soon_days: number; timezone: string };
  canEdit: boolean;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(updateOrgSettingsAction, null);

  if (state?.ok) {
    toast.success(state.message ?? 'Settings saved.');
    router.refresh();
  }

  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      {state && !state.ok && (
        <Alert variant="error">
          <AlertTitle>Could not save settings</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="org_name">Organisation name</Label>
        <Input
          id="org_name"
          name="org_name"
          required
          disabled={!canEdit}
          defaultValue={defaults.org_name}
          maxLength={120}
        />
        <p className="text-xs text-muted-foreground">
          Shown in the browser tab title and on the sign-in screen.
        </p>
        {errors?.org_name && (
          <p className="text-xs text-destructive">{errors.org_name[0]}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="due_soon_days">Days before a deadline counts as &quot;due soon&quot;</Label>
        <Input
          id="due_soon_days"
          name="due_soon_days"
          type="number"
          min={1}
          max={30}
          disabled={!canEdit}
          defaultValue={defaults.due_soon_days}
          className="max-w-28"
        />
        <p className="text-xs text-muted-foreground">
          Drives the due-soon badge on requests, the dashboard bucket, and when the nightly
          sweep starts sending deadline reminders.
        </p>
        {errors?.due_soon_days && (
          <p className="text-xs text-destructive">{errors.due_soon_days[0]}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="timezone">Timezone</Label>
        <Input
          id="timezone"
          name="timezone"
          required
          disabled={!canEdit}
          defaultValue={defaults.timezone}
          placeholder="Asia/Beirut"
        />
        <p className="text-xs text-muted-foreground">
          An IANA timezone name, used when interpreting shift times and reporting deadlines.
        </p>
        {errors?.timezone && <p className="text-xs text-destructive">{errors.timezone[0]}</p>}
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : 'Save settings'}
          </Button>
        </div>
      )}
    </form>
  );
}