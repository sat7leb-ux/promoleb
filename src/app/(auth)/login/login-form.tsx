'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { signInAction, type ActionResult } from '@/lib/auth/actions';
import { SubmitButton } from '@/components/auth/submit-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useState } from 'react';

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(signInAction, null);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  return (
    <form action={formAction} className="space-y-5">
      {state && !state.ok && (
        <Alert variant="error">
          <AlertTitle>Sign-in failed</AlertTitle>
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
          aria-describedby={state && !state.ok && state.fieldErrors?.email ? 'email-error' : undefined}
        />
        {state && !state.ok && state.fieldErrors?.email && (
          <p id="email-error" className="text-xs text-destructive">
            {state.fieldErrors.email[0]}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            className="pr-10"
            invalid={Boolean(state && !state.ok && state.fieldErrors?.password)}
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
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="remember"
          checked={remember}
          onCheckedChange={(v) => setRemember(v === true)}
        />
        <Label htmlFor="remember" className="cursor-pointer font-normal text-muted-foreground">
          Keep me signed in on this device
        </Label>
      </div>

      <SubmitButton className="w-full" size="lg">
        Sign in
      </SubmitButton>

      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="remember" value={remember ? '1' : '0'} />

      <p className="text-center text-xs text-muted-foreground">
        Need access? Contact your SAT-7 administrator.
      </p>
    </form>
  );
}