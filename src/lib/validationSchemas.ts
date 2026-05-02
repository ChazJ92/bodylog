/**
 * Phase 2 — centralized zod-backed validation.
 *
 * Single source of truth for value ranges and payload shapes. Used at:
 * - service boundaries (every write service.parses its input here)
 * - submit-time UI validation in forms (e.g. CheckIn)
 *
 * Form state in the UI stays as raw strings; parsing happens at submit/blur
 * via these schemas so partially typed input is never mutated.
 *
 * Stored canonical units: kg, cm, %.
 */
import { z } from "zod";

export const RANGES = {
  weightKg: { min: 20, max: 400 },
  bodyFatPctManual: { min: 2, max: 80 },
  heightCm: { min: 100, max: 250 },
  measurementCm: { min: 1, max: 400 },
  notesMaxLen: 500,
  photoMaxBytes: 10 * 1024 * 1024,
} as const;

/**
 * Allowed photo MIME types pre-compression.
 *
 * Pipeline note: `browser-image-compression` decodes via the browser's
 * native canvas / `<img>` decoders. HEIC/HEIF is NOT reliably decodable in
 * Chrome / Firefox (Safari only, and even there canvas decode is flaky), so
 * it is intentionally excluded. Stick to the actually supported subset.
 */
export const ALLOWED_PHOTO_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const optionalNumberInRange = (min: number, max: number) =>
  z
    .number()
    .finite()
    .min(min)
    .max(max)
    .optional();

export const checkinPayloadSchema = z.object({
  recordedAt: z.number().finite(),
  weightKg: optionalNumberInRange(RANGES.weightKg.min, RANGES.weightKg.max),
  bodyFatPct: optionalNumberInRange(
    RANGES.bodyFatPctManual.min,
    RANGES.bodyFatPctManual.max,
  ),
  notes: z.string().max(RANGES.notesMaxLen).optional(),
});

export type CheckinPayload = z.infer<typeof checkinPayloadSchema>;

export const checkinPatchSchema = checkinPayloadSchema.partial();
export type CheckinPatch = z.infer<typeof checkinPatchSchema>;

export const profileUpdateSchema = z.object({
  sex: z.enum(["male", "female", "other"]).optional(),
  heightCm: optionalNumberInRange(RANGES.heightCm.min, RANGES.heightCm.max),
  birthYear: z.number().int().min(1900).max(2100).optional(),
});

export const settingsUpdateSchema = z.object({
  weightUnit: z.enum(["kg", "lb"]).optional(),
  lengthUnit: z.enum(["cm", "in"]).optional(),
});

export const measurementValueSchema = z
  .number()
  .finite()
  .min(RANGES.measurementCm.min)
  .max(RANGES.measurementCm.max);

export const photoPreCompressionSchema = z.object({
  mimeType: z.enum(ALLOWED_PHOTO_MIME),
  byteSize: z
    .number()
    .int()
    .nonnegative()
    .max(RANGES.photoMaxBytes),
});

/**
 * Convenience: returns the first issue's message, otherwise null.
 * Used by submit-time UI helpers that show one error per field.
 */
export function firstIssue(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Invalid value";
}
