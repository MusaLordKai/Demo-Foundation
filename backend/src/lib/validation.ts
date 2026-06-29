import { z } from "zod";
import { unprocessable } from "../http/errors";

export const CATEGORIES = ["SPORT", "TECHNOLOGY", "GENERAL_EDUCATION", "QUALITY_OF_LIFE"] as const;

/** Default review pipeline seeded for a new grant (reviewer can reorder/edit). */
export const DEFAULT_WORKFLOW_STEPS = [
  "Initial Screening",
  "Committee Review",
  "Due Diligence",
  "Final Decision",
];

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ---------- Grants ----------
const stepName = z.string().trim().min(1, "Step name is required.").max(100);

export const grantInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(200),
  shortCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, "Short code must be exactly 3 letters.")
    .transform((s) => s.toUpperCase()),
  category: z.enum(CATEGORIES, { errorMap: () => ({ message: "Invalid category." }) }),
  description: z.string().max(5000).optional().default(""),
  fundsAllocated: z.coerce.number({ invalid_type_error: "Funds must be a number." }).positive("Funds must be greater than 0.").finite(),
  openUntil: z.coerce.date({ invalid_type_error: "A valid closing date is required." }),
});
export type GrantInput = z.infer<typeof grantInputSchema>;

export const createGrantSchema = grantInputSchema.extend({
  steps: z.array(stepName).min(1).max(20).optional(),
});

export const workflowStepsSchema = z.object({
  steps: z.array(stepName).min(1, "At least one step is required.").max(20),
});

// ---------- Applications ----------
export const applicationInputSchema = z.object({
  grantId: z.string().uuid("A grant must be selected."),
  title: z.string().trim().min(1).max(200).optional(), // defaults to the grant name
  description: z.string().max(5000).optional().default(""),
  amount: z.coerce.number({ invalid_type_error: "Amount must be a number." }).positive("Amount must be greater than 0.").finite(),
  needBy: z.coerce.date({ invalid_type_error: "needBy must be a valid date." }),
});
export type ApplicationInput = z.infer<typeof applicationInputSchema>;

// Editing a DRAFT — grant (and category) cannot change after creation.
export const applicationUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(5000).optional().default(""),
  amount: z.coerce.number({ invalid_type_error: "Amount must be a number." }).positive("Amount must be greater than 0.").finite(),
  needBy: z.coerce.date({ invalid_type_error: "needBy must be a valid date." }),
});
export type ApplicationUpdate = z.infer<typeof applicationUpdateSchema>;

/** Optional comment carried by reviewer actions (the guard enforces when required). */
export const actionSchema = z.object({
  comment: z.string().optional(),
});

/** Parse with a schema or throw a 422 AppError carrying field-level details. */
export function parse<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw unprocessable("Validation failed", result.error.flatten());
  }
  return result.data;
}
