'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { ActionResult } from '@/lib/auth/actions';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive actions render the confirm button in red. */
  destructive?: boolean;
  /** Optional extra confirmation, e.g. typing the project name. */
  requireText?: string;
  onConfirm: () => Promise<ActionResult>;
  onSuccess?: () => void;
}

/**
 * Confirmation dialog for destructive or irreversible actions.
 *
 * Catches its own errors and toasts them, so callers only supply the action.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  requireText,
  onConfirm,
  onSuccess,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const [isPending, startTransition] = useTransition();

  const confirmationSatisfied = !requireText || typed.trim() === requireText;

  function handleConfirm() {
    startTransition(async () => {
      const result = await onConfirm();

      if (result.ok) {
        toast.success(result.message ?? 'Done');
        setTyped('');
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {destructive && (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertCircle className="h-4 w-4" aria-hidden />
              </span>
            )}
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {requireText && (
          <div className="space-y-2">
            <label htmlFor="confirm-text" className="text-sm text-muted-foreground">
              Type <span className="font-semibold text-foreground">{requireText}</span> to confirm
            </label>
            <input
              id="confirm-text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={!confirmationSatisfied}
            isLoading={isPending}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Small helper so list rows can hold open/close state for one dialog. */
export function useConfirmDialog() {
  const [target, setTarget] = useState<{
    title: string;
    description: string;
    confirmLabel?: string;
    destructive?: boolean;
    requireText?: string;
    action: () => Promise<ActionResult>;
  } | null>(null);

  return {
    target,
    open: target !== null,
    close: () => setTarget(null),
    confirm: (config: NonNullable<typeof target>) => setTarget(config),
    dialogProps: target
      ? {
          open: true,
          onOpenChange: (open: boolean) => {
            if (!open) setTarget(null);
          },
          ...target,
        }
      : null,
  };
}