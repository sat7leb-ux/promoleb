import { z } from 'zod';

/** Field-level validation messages, keyed by form field name. */
export type FieldErrors = Record<string, string[]>;

/**
 * Flattens a ZodError into the `fieldErrors` shape Server Actions return.
 *
 * `flatten()` types each entry as `string[] | undefined`, so the empty and
 * missing entries are dropped here. Clients can then iterate the result
 * without null checks, and the type is a plain `Record<string, string[]>`.
 *
 * Deliberately not exported from a `'use server'` module: every export of such
 * a module must be an async function, and this is a pure helper.
 */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const [field, messages] of Object.entries(error.flatten().fieldErrors)) {
    if (messages && messages.length > 0) fieldErrors[field] = messages;
  }
  return fieldErrors;
}