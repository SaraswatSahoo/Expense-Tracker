import type { Request } from "express";
import { z } from "zod";

const uuid = z.uuid({ error: "Must be a valid ID" });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email({ error: "Must be a valid email" }));

export const passwordSchema = z.string().min(8).max(128);
export const nameSchema = z.string().trim().min(1).max(100);
export const currencySchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "Must be three capital letters, such as INR");

// A string rather than a number, because JSON numbers aren't exact.
// Ten whole digits and two decimals fit the Decimal(12, 2) columns.
export const moneySchema = z
  .string()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, 'Must be a string such as "100.50"')
  .refine((value) => Number(value) > 0, "Must be greater than zero");

// Date-only columns are stored as midnight UTC.
export const dateSchema = z.iso
  .date({ error: "Must be a date in YYYY-MM-DD format" })
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

export const userIdSchema = uuid;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;

export function idParam(req: Request, name: string): string {
  return uuid.parse(req.params[name]);
}

export function hasAnyField(value: object): boolean {
  return Object.values(value).some((field) => field !== undefined);
}

export const NO_FIELDS_MESSAGE = "Provide at least one field to update";
