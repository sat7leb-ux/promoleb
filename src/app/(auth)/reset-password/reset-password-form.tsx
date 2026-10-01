'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { resetPasswordAction } from '@/lib/auth/actions';
import { SubmitButton } from '@/components/auth/submit-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

/** Shared strength hint so both password screens read identically. */
function PasswordRules({ id }: { id: string }) {
  return (
    <ul id={id} className="space-y-0.5 text-xs text-muted-foreground">
      {[
        'At least 10 characters',
        'One uppercase and one lowercase letter',
        'At least one number',
        'At least one symbol',
      ].map((rule) => (
        <li key={rule} className="flex items-center gap-1.5">
          <span className="size-1 rounded-full bg-muted-foreground" aria-hidden />
          {rule}
        </li>
      ))}
    </ul>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [state, formAction] = useActionState(resetPasswordAction, null);
  const [showPassword, setShowPassword] = useState(false);

  // A recovery session only exists while the emailed link is fresh. Detect it
  // up front so the user is told plainly rather than failing on submit.
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const { createBrowserClient } = await import('@/lib/supabase/client');
        const supabase = createBrowserClient();
        const { data } = await supabase.auth.getSession();
        if (active) setHasSession(Boolean(data.session));
      } catch {
        if (active) setHasSession(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  if (hasSession === false) {
    return (
      <div className="space-y-4">
        <Alert variant="warning">
          <AlertTitle>This link is no longer valid</AlertTitle>
          <AlertDescription>
            Password reset links expire after one hour and can only be used once. Request a fresh
            link to continue.
          </AlertDescription>
        </Alert>
        <Button asChild className="w-full">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  if (state?.ok) {
    return (
      <div className="space-y-4">
        <Alert variant="success">
          <AlertTitle>Password updated</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
        <Button className="w-full" onClick={() => router.push('/login')}>
          Go to sign in
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      {state && !state.ok && (
        <Alert variant="error">
          <AlertTitle>We could not update your password</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            className="pr-10"
            aria-describedby="password-rules"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <PasswordRules id="password-rules" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          required
          invalid={Boolean(state && !state.ok && state.fieldErrors?.confirmPassword)}
        />
        {state && !state.ok && state.fieldErrors?.confirmPassword && (
          <p className="text-xs text-destructive">{state.fieldErrors.confirmPassword[0]}</p>
        )}
      </div>

      <SubmitButton className="w-full" size="lg">
        Update password
      </SubmitButton>
    </form>
  );
}