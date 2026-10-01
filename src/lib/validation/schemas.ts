import { z } from 'zod';

/**
 * Shared validation schemas.
 *
 * These are used by Server Actions (trust nothing from the client) and, via
 * zodResolver, by the client forms (fail fast before a round trip). Defining
 * them once means the two can never disagree about what is valid.
 */

const optionalUuid = z.preprocess(
  // Empty strings arrive from blank form fields and mean "not set".
  (value) => (value === '' || value === undefined ? null : value),
  z.string().uuid().nullable(),
);
/**
 * Blank means "not set".
 *
 * `preprocess` normalises both `''` and `null` to `null` first, so callers may
 * submit either (client forms produce `''`; the shifts panel produces `null`)
 * and both validate. Text is trimmed, and an over-long value fails with a
 * message rather than being silently cut.
 */
const optionalText = (max = 500) =>
  z.preprocess(
    (v) => (v === '' || v === undefined ? null : typeof v === 'string' ? v.trim() : v),
    z
      .string()
      .max(max, `Must be ${max} characters or fewer`)
      .nullable(),
  );

const optionalDate = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date picker')
    .nullable(),
);

const optionalTime = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Use a valid time')
    .nullable(),
);

const promoRequestObject = z
  .object({
    // --- basic information ---
    title: z.string().trim().min(3, 'Enter a promo or project name').max(200),
    request_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Select a request date'),
    requested_by_id: optionalUuid,
    requested_by_name: optionalText(120),
    company_department: optionalText(120),
    project_id: optionalUuid,
    program_id: optionalUuid,
    channel_id: optionalUuid,
    goal_id: optionalUuid,
    promo_type_id: optionalUuid,
    // A blank numeric input arrives as '', and Number('') is 0; treat that as
    // "not provided" rather than a real zero.
    episodes_count: z.preprocess(
      (v) => (v === '' || v === undefined || v === null ? null : v),
      z.coerce
        .number({ invalid_type_error: 'Enter a number' })
        .int()
        .min(0, 'Cannot be negative')
        .max(9999)
        .nullable(),
    ),
    priority: z.enum(['low', 'normal', 'high', 'urgent']),
    due_date: optionalDate,

    // --- production information ---
    assigned_to_id: optionalUuid,
    // Defaults to 1 when left blank: a request with no shifts is almost always
    // an oversight, and the schema enforces an explicit 0 if that is intended.
    shift_count: z.preprocess(
      (v) => (v === '' || v === undefined || v === null ? 1 : v),
      z.coerce
        .number({ invalid_type_error: 'Enter the number of shifts' })
        .int('Shifts must be a whole number')
        .min(0, 'Cannot be negative')
        .max(60, 'That is more shifts than a request should have'),
    ),
    production_start_date: optionalDate,
    production_end_date: optionalDate,
    call_time: optionalTime,
    location: optionalText(200),
    notes: optionalText(4000),
    special_instructions: optionalText(4000),
    internal_notes: optionalText(4000),

    // --- promo information ---
    promo_goal: optionalText(1000),
    target_audience: optionalText(500),
    promo_description: optionalText(4000),
    key_message: optionalText(1000),
    required_deliverables: optionalText(2000),
    duration_seconds: z.preprocess(
      (v) => (v === '' || v === undefined || v === null ? null : v),
      z.coerce
        .number({ invalid_type_error: 'Enter seconds as a number' })
        .int()
        .min(0)
        .max(36000, 'That is longer than ten hours')
        .nullable(),
    ),
    format: optionalText(80),
    language: optionalText(80),
    version: optionalText(40),

    // --- workflow ---
    stage_id: z.string().uuid('Select a status'),
  });

/**
 * The request form's object schema, before the cross-field rules are applied.
 *
 * Exposed separately because `.refine()` returns a ZodEffects, which has no
 * `.extend()`. The client form extends this to relax two numeric fields, since
 * an empty number input coerces to NaN rather than null.
 */
export const promoRequestBaseSchema = promoRequestObject;

/**
 * Full validation for a promo request, including the cross-field rules:
 *   - due date cannot precede the request date
 *   - production end cannot precede production start
 *   - a channel is required whenever a program is chosen
 */
export const promoRequestSchema = promoRequestObject.superRefine((data, ctx) => {
  if (data.due_date && data.due_date < data.request_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'The due date cannot be before the request date',
      path: ['due_date'],
    });
  }

  if (
    data.production_start_date &&
    data.production_end_date &&
    data.production_end_date < data.production_start_date
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'The production end date cannot be before the start date',
      path: ['production_end_date'],
    });
  }

  if (data.program_id && !data.channel_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A channel is required when a program is selected',
      path: ['channel_id'],
    });
  }
});

export type PromoRequestInput = z.infer<typeof promoRequestSchema>;

const shiftObject = z.object({
  id: z.string().uuid(),
  shift_date: optionalDate,
  start_time: optionalTime,
  end_time: optionalTime,
  assigned_to_id: optionalUuid,
  location: optionalText(200),
  notes: optionalText(2000),
  status: z.enum(['planned', 'in_progress', 'done', 'cancelled']),
  /** Kept for the audit trail; the server recomputes the real numbering. */
  shift_number: z.coerce.number().int().optional(),
});

/** One production shift. An end time cannot precede its start time. */
export const shiftSchema = shiftObject.superRefine((data, ctx) => {
  if (data.start_time && data.end_time && data.end_time < data.start_time) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'The end time cannot be before the start time',
      path: ['end_time'],
    });
  }
});

export type ShiftInput = z.infer<typeof shiftSchema>;

export const noteSchema = z.object({
  body: z.string().trim().min(1, 'Write something first').max(4000),
  is_internal: z.coerce.boolean().default(true),
});

export const participantSchema = z.object({
  user_id: z.string().uuid('Select a user'),
  responsibility: optionalText(120),
  notes: optionalText(500),
});

// --- reference data -------------------------------------------------------

export const channelSchema = z.object({
  name: z.string().trim().min(2, 'Enter a channel name').max(120),
  code: optionalText(40),
  description: optionalText(500),
  category: optionalText(60),
  color: z.string().trim().min(1).default('brand'),
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
  notes: optionalText(1000),
  status: z.enum(['active', 'inactive', 'archived']).default('active'),
});

export const programSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter a program name').max(200),
    description: optionalText(2000),
    channel_id: optionalUuid,
    responsible_id: optionalUuid,
    image_url: optionalText(500),
    status: z.enum(['active', 'inactive', 'archived']).default('active'),
    start_date: optionalDate,
    end_date: optionalDate,
    notes: optionalText(2000),
  })
  .refine((d) => !d.start_date || !d.end_date || d.end_date >= d.start_date, {
    message: 'The end date cannot be before the start date',
    path: ['end_date'],
  });

export const projectSchema = z
  .object({
    code: optionalText(40),
    name: z.string().trim().min(2, 'Enter a project name').max(200),
    description: optionalText(2000),
    manager_id: optionalUuid,
    status: z.enum(['active', 'inactive', 'archived']).default('active'),
    start_date: optionalDate,
    end_date: optionalDate,
    notes: optionalText(2000),
    member_ids: z.array(z.string().uuid()).default([]),
    program_ids: z.array(z.string().uuid()).default([]),
  })
  .refine((d) => !d.start_date || !d.end_date || d.end_date >= d.start_date, {
    message: 'The end date cannot be before the start date',
    path: ['end_date'],
  });

export const goalSchema = z.object({
  name: z.string().trim().min(2, 'Enter a goal name').max(200),
  description: optionalText(1000),
  category: optionalText(80),
  color: z.string().trim().min(1).default('violet'),
  is_active: z.coerce.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
});

export const promoTypeSchema = z.object({
  name: z.string().trim().min(2, 'Enter a type name').max(120),
  description: optionalText(500),
  is_active: z.coerce.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
});

export const stageSchema = z.object({
  name: z.string().trim().min(2, 'Enter a stage name').max(80),
  description: optionalText(500),
  position: z.coerce.number().int().min(0).max(999),
  color: z.string().trim().min(1).default('slate'),
  is_terminal: z.coerce.boolean().default(false),
  is_cancelled: z.coerce.boolean().default(false),
});

export const settingsSchema = z.object({
  org_name: z.string().trim().min(2).max(120),
  due_soon_days: z.coerce.number().int().min(1).max(30).default(3),
  timezone: z.string().trim().min(1).default('Asia/Beirut'),
});

/** Reads a boolean from an HTML checkbox value ('on' / 'true' / undefined). */
export function checkboxToBool(value: FormDataEntryValue | null): boolean {
  return value === 'on' || value === 'true' || value === '1';
}