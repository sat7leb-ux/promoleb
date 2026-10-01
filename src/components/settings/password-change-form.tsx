'use client';

import { useActionState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { changePasswordAction } from '@/lib/auth/actions';

/**
 * Password change for the signed-in user.
 *
 * The action re-authenticates before applying the change, so a hijacked session
 * cannot be used to lock the real owner out of their own account. The copy says
 * so, because otherwise an unexpected "incorrect password" is baffling.
 */
export function PasswordChangeForm() {
  const [state, formAction, isPending] = useActionState(changePasswordAction, null);

  if (state?.ok) {
    toast.success(state.message ?? 'Password changed.');
    // A full reload guarantees the new value is what gets sent on the next
    // sign-in, and clears the form so nothing is left in the DOM.
    if (typeof window !== 'undefined') window.location.reload();
  }

  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      {state && !state.ok && (
        <Alert variant="error">
          <AlertTitle>Could not change your password</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">
          Current password <span className="text-destructive">*</span>
        </Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
        />
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
          We verify this before applying the change, so a stolen session cannot lock you out.
        </p>
        {errors?.currentPassword && (
          <p className="text-xs text-destructive">{errors.currentPassword[0]}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">
          New password <span className="text-destructive">*</span>
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
        />
        {errors?.password && <p className="text-xs text-destructive">{errors.password[0]}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">
          Confirm new password <span className="text-destructive">*</span>
        </Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
        />
        {errors?.confirmPassword && (
          <p className="text-xs text-destructive">{errors.confirmPassword[0]}</p>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          <KeyRound className="size-4" />
          {isPending ? 'Updating...' : 'Change password'}
        </Button>
      </div>
    </form>
  );
}