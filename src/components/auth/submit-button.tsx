'use client';

import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { Button as UiButton, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Submit button wired to the parent form's pending state.
 *
 * useFormStatus disables the button and shows a spinner while the Server Action
 * runs, so there is no local state to keep in step with the request.
 */
export function SubmitButton({
  children,
  isLoading,
  className,
  ...props
}: ButtonProps & { isLoading?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <UiButton
      type="submit"
      disabled={isLoading || pending}
      aria-busy={pending || undefined}
      className={cn(className)}
      {...props}
    >
      {(isLoading || pending) && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </UiButton>
  );
}
