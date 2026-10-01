'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';
import { toFieldErrors, type FieldErrors } from '@/lib/validation/field-errors';
import { requireUser } from './session';
import { permissionsFor } from './permissions';

/**
 * Every Server Action returns this shape. Client components branch on `ok`
 * and surface `error`/`fieldErrors` rather than parsing thrown strings.
 */
/**
 * Result shape returned by every Server Action.
 *
 * `data` is always present on success (as `undefined` where there is nothing
 * to return) so client components can read `result.data.id` without a null
 * check. Note the union: `ok: false` never carries `data`.
 */


export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

/**
 * Variance-friendly alias for useActionState.
 *
 * React types the state parameter of a reducer against the action's declared
 * state type. Passing the union where `T` differs (a form declared with the
 * default `undefined` but returning data) is a contravariance error, so
 * callers pass this widened shape instead.
 */
export type ActionState<T = unknown> = ActionResult<T> | ActionResult | null;

/**
 * State type for `useActionState` in client components.
 *
 * The payload is `any` so the type stays bivariant: a form declared with this
 * accepts the result of an action returning a specific data shape (such as
 * `{ email: string }` from the password-reset flow) without a cast.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FormState = ActionResult<any> | null;

function fail(error: string, fieldErrors?: FieldErrors): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}


// ---------------------------------------------------------------------------
// Sign in
// ---------------------------------------------------------------------------
const signInSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

export async function signInAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) return fail('Please correct the highlighted fields.', toFieldErrors(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Deliberately vague: never reveal whether the account exists.
    return fail('Incorrect email or password.');
  }

  // Stamp last activity. Best-effort; must not block sign-in.
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id);
    }
  } catch {
    /* ignore */
  }

  redirect('/dashboard');
}

// ---------------------------------------------------------------------------
// Sign out
// ---------------------------------------------------------------------------
export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

// ---------------------------------------------------------------------------
// Forgot password
// ---------------------------------------------------------------------------
const forgotSchema = z.object({ email: z.string().trim().email('Enter a valid email address') });

export async function requestPasswordResetAction(
  _prev: ActionResult<{ email: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ email: string }>> {
  const parsed = forgotSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return fail('Please correct the highlighted fields.', toFieldErrors(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.siteUrl}/reset-password`,
  });

  if (error) {
    console.error('[auth] reset request failed:', error.message);
    return fail('We could not send the reset email. Please try again.');
  }

  return {
    ok: true,
    data: { email: parsed.data.email },
    message: 'If an account exists for that address, a reset link is on its way.',
  };
}

// ---------------------------------------------------------------------------
// Set a new password (from the reset email link)
// ---------------------------------------------------------------------------
const resetSchema = z
  .object({
    password: z
      .string()
      .min(10, 'Use at least 10 characters')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/[a-z]/, 'Include a lowercase letter')
      .regex(/[0-9]/, 'Include a number')
      .regex(/[^A-Za-z0-9]/, 'Include a symbol'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export async function resetPasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = resetSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) return fail('Please correct the highlighted fields.', toFieldErrors(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return fail(
      'This reset link is invalid or has expired. Request a new one from the forgot-password screen.',
    );
  }

  return { ok: true, data: undefined, message: 'Password updated. You can sign in now.' };
}

// ---------------------------------------------------------------------------
// Change own password (signed in)
// ---------------------------------------------------------------------------
export async function changePasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = resetSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) return fail('Please correct the highlighted fields.', toFieldErrors(parsed.error));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return fail('Your session has expired. Please sign in again.');

  // Re-authenticate first so a stolen session cannot lock the owner out.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email ?? '',
    password: formData.get('currentPassword')?.toString() ?? '',
  });

  if (verifyError) return fail('Your current password is incorrect.', { currentPassword: ['Incorrect password'] });

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail('We could not update your password. Please try again.');

  return { ok: true, data: undefined, message: 'Password changed.' };
}

// ---------------------------------------------------------------------------
// Update own profile
// ---------------------------------------------------------------------------
const profileSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter your full name'),
  job_title: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  avatar_url: z.string().trim().url('Enter a valid URL').optional().or(z.literal('')),
});

export async function updateProfileAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireUser();
  const parsed = profileSchema.safeParse({
    full_name: formData.get('full_name'),
    job_title: formData.get('job_title') ?? '',
    phone: formData.get('phone') ?? '',
    avatar_url: formData.get('avatar_url') ?? '',
  });

  if (!parsed.success) return fail('Please correct the highlighted fields.', toFieldErrors(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: parsed.data.full_name,
      job_title: parsed.data.job_title || null,
      phone: parsed.data.phone || null,
      avatar_url: parsed.data.avatar_url || null,
    })
    .eq('id', session.profile.id);

  if (error) return fail('We could not save your profile. Please try again.');

  revalidatePath('/settings/profile');
  return { ok: true, data: undefined, message: 'Profile updated.' };
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export async function markNotificationsReadAction(ids?: string[]): Promise<ActionResult> {
  const session = await requireUser();
  const supabase = await createClient();

  const query = supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', session.profile.id);

  if (ids && ids.length > 0) {
    await query.in('id', ids);
  } else {
    await query.is('read_at', null);
  }

  revalidatePath('/notifications');
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Admin: user management (service role required for auth.users writes)
// ---------------------------------------------------------------------------
const createUserSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  full_name: z.string().trim().min(2, 'Enter the full name'),
  role: z.enum(['administrator', 'promo_manager', 'producer', 'viewer']),
  job_title: z.string().trim().optional(),
  password: z
    .string()
    .min(10, 'Use at least 10 characters')
    .regex(/[A-Z]/, 'Include an uppercase letter')
    .regex(/[a-z]/, 'Include a lowercase letter')
    .regex(/[0-9]/, 'Include a number'),
});

export async function createUserAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireUser();
  if (!permissionsFor(session.role).canManageUsers) {
    return fail('You do not have permission to create users.');
  }

  const parsed = createUserSchema.safeParse({
    email: formData.get('email'),
    full_name: formData.get('full_name'),
    role: formData.get('role'),
    job_title: formData.get('job_title') ?? '',
    password: formData.get('password'),
  });

  if (!parsed.success) return fail('Please correct the highlighted fields.', toFieldErrors(parsed.error));

  // The password travels here from an admin-supplied form field. It is never
  // stored, never logged, and never rendered back to the client.
  const admin = await createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.full_name },
  });

  if (error) {
    if (/already/i.test(error.message)) {
      return fail('An account with that email already exists.', {
        email: ['This email is already in use'],
      });
    }
    console.error('[users] create failed:', error.message);
    return fail('We could not create that account. Please try again.');
  }

  await admin
    .from('profiles')
    .update({ role: parsed.data.role, job_title: parsed.data.job_title || null })
    .eq('id', data.user.id);

  revalidatePath('/users');
  return {
    ok: true,
    data: undefined,
    message: `${parsed.data.full_name} can now sign in with ${parsed.data.email}.`,
  };
}

const updateUserSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().trim().min(2, 'Enter the full name'),
  role: z.enum(['administrator', 'promo_manager', 'producer', 'viewer']),
  status: z.enum(['active', 'inactive', 'archived']),
  job_title: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export async function updateUserAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireUser();
  if (!permissionsFor(session.role).canManageUsers) {
    return fail('You do not have permission to edit users.');
  }

  const parsed = updateUserSchema.safeParse({
    user_id: formData.get('user_id'),
    full_name: formData.get('full_name'),
    role: formData.get('role'),
    status: formData.get('status'),
    job_title: formData.get('job_title') ?? '',
    phone: formData.get('phone') ?? '',
    notes: formData.get('notes') ?? '',
  });

  if (!parsed.success) return fail('Please correct the highlighted fields.', toFieldErrors(parsed.error));

  // Guard against an admin locking themselves out.
  if (parsed.data.user_id === session.profile.id) {
    if (parsed.data.role !== 'administrator') {
      return fail('You cannot remove your own administrator role.', { role: ['Not allowed'] });
    }
    if (parsed.data.status !== 'active') {
      return fail('You cannot deactivate your own account.', { status: ['Not allowed'] });
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: parsed.data.full_name,
      role: parsed.data.role,
      status: parsed.data.status,
      job_title: parsed.data.job_title || null,
      phone: parsed.data.phone || null,
      notes: parsed.data.notes || null,
    })
    .eq('id', parsed.data.user_id);

  if (error) return fail('We could not save that user. Please try again.');

  revalidatePath('/users');
  return { ok: true, data: undefined, message: 'User updated.' };
}

export async function adminResetPasswordAction(
  userId: string,
  newPassword: string,
): Promise<ActionResult> {
  const session = await requireUser();
  if (!permissionsFor(session.role).canManageUsers) {
    return fail('You do not have permission to reset passwords.');
  }

  const result = z
    .string()
    .min(10)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/)
    .safeParse(newPassword);

  if (!result.success) {
    return fail('Password must be at least 10 characters with upper, lower and a number.');
  }

  const admin = await createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (error) {
    console.error('[users] admin password reset failed:', error.message);
    return fail('We could not reset that password. Please try again.');
  }

  return { ok: true, data: undefined, message: 'Password reset. Share it with the user securely.' };
}