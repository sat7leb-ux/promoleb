'use client';

import { useActionState } from 'react';
import { MailCheck } from 'lucide-react';
import { requestPasswordResetAction } from '@/lib/auth/actions';
import { SubmitButton } from '@/components/auth/submit-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function ForgotPasswordForm() {
  // The action's own signature carries the `{ email }` payload, so inference
  // gives `state.data.email` without a cast here.
  const [state, formAction] = useActionState(
    requestPasswordResetAction,
    null,
  );

  if (state?.ok) {
    return (
      <div className="space-y-4 rounded-xl border bg-card p-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          <MailCheck className="size-6" aria-hidden />
        </span>
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold">Check your email</h2>
          <p className="text-sm text-muted-foreground">
            If an account exists for{' '}
            <span className="font-medium text-foreground">{state.data.email}</span>, a reset link
            is on its way. The link expires after one hour.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Nothing arrived? Check your spam folder, then try again.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      {state && !state.ok && (
        <Alert variant="error">
          <AlertTitle>We could not send the link</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="name@sat7.org"
          autoFocus
          invalid={Boolean(state && !state.ok && state.fieldErrors?.email)}
        />
        {state && !state.ok && state.fieldErrors?.email && (
          <p className="text-xs text-destructive">{state.fieldErrors.email[0]}</p>
        )}
      </div>

      <SubmitButton className="w-full" size="lg">
        Send reset link
      </SubmitButton>

      <p className="text-center text-xs text-muted-foreground">
        For security, we will not confirm whether an account exists.
      </p>
    </form>
  );
}