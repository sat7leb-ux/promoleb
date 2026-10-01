'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { UserAvatar } from '@/components/shared/user-avatar';
import { updateProfileAction } from '@/lib/auth/actions';
import { ROLE_META } from '@/lib/constants';
import type { AppRole, Profile } from '@/types/database';

/**
 * Self-service profile editing.
 *
 * Deliberately does not expose the role: users cannot promote themselves, and
 * hiding the field removes a class of confusing support requests. Role changes
 * go through the users page, which requires `canManageUsers`.
 */
export function ProfileSettingsForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(updateProfileAction, null);

  if (state?.ok) {
    toast.success(state.message ?? 'Profile updated.');
    router.refresh();
  }

  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const role = profile.role as AppRole;

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      {state && !state.ok && (
        <Alert variant="error">
          <AlertTitle>Could not save your profile</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-4 rounded-xl border bg-card p-4">
        <UserAvatar
          name={profile.full_name}
          avatarUrl={profile.avatar_url}
          className="size-12"
          fallbackClassName="text-base"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{profile.full_name}</p>
          <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
          <p className="mt-1 text-xs font-medium text-primary">
            {ROLE_META[role]?.label ?? role}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="full_name">
          Full name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="full_name"
          name="full_name"
          required
          defaultValue={profile.full_name}
          autoComplete="name"
        />
        {errors?.full_name && <p className="text-xs text-destructive">{errors.full_name[0]}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="job_title">Job title</Label>
        <Input
          id="job_title"
          name="job_title"
          defaultValue={profile.job_title ?? ''}
          placeholder="Producer, Editor, Promo Manager"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={profile.phone ?? ''}
          autoComplete="tel"
          placeholder="+961 1 234 567"
        />
        {errors?.phone && <p className="text-xs text-destructive">{errors.phone[0]}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="avatar_url">Avatar URL</Label>
        <Input
          id="avatar_url"
          name="avatar_url"
          type="url"
          defaultValue={profile.avatar_url ?? ''}
          placeholder="https://..."
        />
        <p className="text-xs text-muted-foreground">
          Paste an image address to use something other than your initials.
        </p>
        {errors?.avatar_url && <p className="text-xs text-destructive">{errors.avatar_url[0]}</p>}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : 'Save profile'}
        </Button>
      </div>
    </form>
  );
}