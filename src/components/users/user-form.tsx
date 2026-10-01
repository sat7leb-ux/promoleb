'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { KeyRound, Plus, Shield, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SubmitButton } from '@/components/auth/submit-button';
import {
  createUserAction,
  updateUserAction,
  adminResetPasswordAction,
  type FormState,
} from '@/lib/auth/actions';
import {
  ALL_ROLES,
  PERMISSIONS_BY_ROLE,
  describePermissionSet,
  roleDescription,
  roleLabel,
} from '@/lib/auth/permissions';
import type { AppRole, Profile } from '@/types/database';

interface Props {
  /** Null when creating a user; set when editing. */
  user: Profile | null;
  /** The signed-in admin, who cannot demote or deactivate themselves. */
  currentUserId: string;

  onOpenChange: (open: boolean) => void;
}

export function UserFormDialog({ user, currentUserId, onOpenChange }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<'details' | 'password'>('details');

  // Both actions share the ActionResult signature, so the union resolves
  // cleanly; FormState keeps the state loosely typed for reading fieldErrors.
  const [createState, createAction, creating] = useActionState(createUserAction, null) as [
    FormState,
    (formData: FormData) => void,
    boolean,
  ];
  const [updateState, updateAction, updating] = useActionState(updateUserAction, null) as [
    FormState,
    (formData: FormData) => void,
    boolean,
  ];

  const isCreating = user === null;
  const state = isCreating ? createState : updateState;
  const action = isCreating ? createAction : updateAction;
  const isPending = isCreating ? creating : updating;

  if (state?.ok) {
    toast.success(state.message ?? 'Saved');
    onOpenChange(false);
    router.refresh();
  }

  return (
    <>
      {user && (
        <div className="mb-4 flex gap-1 rounded-lg bg-muted p-1">
          <Button
            type="button"
            size="sm"
            variant={mode === 'details' ? 'secondary' : 'ghost'}
            className="flex-1"
            onClick={() => setMode('details')}
          >
            <UserCog className="size-3.5" />
            Details
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'password' ? 'secondary' : 'ghost'}
            className="flex-1"
            onClick={() => setMode('password')}
          >
            <KeyRound className="size-3.5" />
            Reset password
          </Button>
        </div>
      )}

      {mode === 'password' && user ? (
        <PasswordResetPanel user={user} />
      ) : (
        <form action={action} className="space-y-4" key={user?.id ?? 'new'}>
          {user && <input type="hidden" name="user_id" value={user.id} />}

          {state && !state.ok && (
            <Alert variant="error">
              <AlertTitle>Could not save</AlertTitle>
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="user-email">
              Email address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="user-email"
              name="email"
              type="email"
              autoComplete="off"
              defaultValue={user?.email ?? ''}
              placeholder="name@sat7.org"
              required
              // Email is the auth identifier, so it cannot be edited after creation.
              disabled={!isCreating}
              readOnly={!isCreating}
            />
            {!isCreating && (
              <p className="text-xs text-muted-foreground">
                Email cannot be changed. Create a new account instead.
              </p>
            )}
            {state && !state.ok && state.fieldErrors?.email && (
              <p className="text-xs text-destructive">{state.fieldErrors.email[0]}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="user-name">
                Full name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="user-name"
                name="full_name"
                defaultValue={user?.full_name ?? ''}
                required
                autoFocus={isCreating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-job">Job title</Label>
              <Input
                id="user-job"
                name="job_title"
                defaultValue={user?.job_title ?? ''}
                placeholder="Producer, Editor…"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="user-role">
                Role <span className="text-destructive">*</span>
              </Label>
              <Select name="role" defaultValue={user?.role ?? 'viewer'}>
                <SelectTrigger id="user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {roleLabel(role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {state && !state.ok && state.fieldErrors?.role && (
                <p className="text-xs text-destructive">{state.fieldErrors.role[0]}</p>
              )}
            </div>

            {user && (
              <div className="space-y-2">
                <Label htmlFor="user-status">Status</Label>
                <Select name="status" defaultValue={user.status}>
                  <SelectTrigger id="user-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  An inactive account is signed out and cannot sign in.
                </p>
              </div>
            )}
          </div>

          {isCreating && (
            <div className="space-y-2">
              <Label htmlFor="user-password">
                Temporary password <span className="text-destructive">*</span>
              </Label>
              <Input
                id="user-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                placeholder="At least 10 characters"
              />
              <p className="text-xs text-muted-foreground">
                Share it with the user securely. They should change it from Settings → Security
                after signing in.
              </p>
              {state && !state.ok && state.fieldErrors?.password && (
                <p className="text-xs text-destructive">
                  {state.fieldErrors.password[0]}
                </p>
              )}
            </div>
          )}

          {user && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="user-phone">Phone</Label>
                <Input id="user-phone" name="phone" defaultValue={user.phone ?? ''} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="user-notes">Admin notes</Label>
                <Textarea
                  id="user-notes"
                  name="notes"
                  defaultValue={user.notes ?? ''}
                  rows={2}
                  placeholder="Skills, availability, anything staff should know"
                />
              </div>
            </div>
          )}

          {user?.id === currentUserId && (
            <Alert variant="info">
              <Shield className="size-4" />
              <AlertDescription>
                This is your own account. You cannot remove your administrator role or deactivate
                yourself.
              </AlertDescription>
            </Alert>
          )}

          <RolePreview role={(user?.role ?? 'viewer') as AppRole} />

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SubmitButton isLoading={isPending}>
              {isCreating ? 'Create user' : 'Save changes'}
            </SubmitButton>
          </div>
        </form>
      )}
    </>
  );
}

/** Shows what a role can do, so an admin picks deliberately. */
function RolePreview({ role }: { role: AppRole }) {
  const permissions = describePermissionSet(PERMISSIONS_BY_ROLE[role]);

  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <p className="text-xs font-medium">{roleLabel(role)} can:</p>
      <p className="mt-1 text-xs text-muted-foreground">{roleDescription(role)}</p>
      <p className="mt-1.5 text-[11px] text-muted-foreground">{permissions}</p>
    </div>
  );
}

/**
 * Admin password reset.
 *
 * The new password is entered by the admin and sent straight to the Auth API;
 * it is never stored in state beyond the form field and is not echoed back.
 */
function PasswordResetPanel({ user }: { user: Profile }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);

  async function submit() {
    if (password !== confirm) {
      toast.error('The passwords do not match.');
      return;
    }

    setPending(true);
    const result = await adminResetPasswordAction(user.id, password);
    setPending(false);

    if (result.ok) {
      toast.success(result.message ?? 'Password reset');
      setPassword('');
      setConfirm('');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-4">
      <Alert variant="warning">
        <AlertTitle>You are changing another person&apos;s password</AlertTitle>
        <AlertDescription>
          Share the new password with {user.full_name} over a secure channel, and ask them to
          change it after signing in. This cannot be undone.
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <Label htmlFor="reset-password">New password</Label>
        <Input
          id="reset-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 10 characters"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reset-confirm">Confirm new password</Label>
        <Input
          id="reset-confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>

      <Button
        onClick={submit}
        disabled={password.length < 10 || password !== confirm}
        isLoading={pending}
        className="w-full"
      >
        <KeyRound className="size-4" />
        Reset password
      </Button>

      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Plus className="size-3" aria-hidden />
        Alternatively, the user can use the “forgot password” link on the sign-in screen.
      </p>
    </div>
  );
}