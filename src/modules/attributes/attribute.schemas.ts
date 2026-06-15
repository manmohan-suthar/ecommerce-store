import { z } from "zod";

const attributeDisplayTypes = ["SELECT", "COLOR", "BUTTON"] as const;

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must use lowercase letters, numbers, and hyphens.");

export const attributeInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: slugSchema,
  description: z.string().trim().max(300).optional().nullable().transform((value) => value || null),
  displayType: z.enum(attributeDisplayTypes).default("SELECT"),
  displayOrder: z.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
  isVisibleOnStorefront: z.boolean().default(true),
  isUsedForVariations: z.boolean().default(true),
});

export const attributeValueInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: slugSchema,
  colorHex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a 6-digit hex value.")
    .optional()
    .nullable()
    .transform((value) => value || null),
  displayOrder: z.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});

export const reorderSchema = z.object({
  items: z.array(z.object({ id: z.string().uuid(), displayOrder: z.number().int().min(0).max(9999) })).min(1),
});

export const statusSchema = z.object({ isActive: z.boolean() });

export type AttributeInput = z.infer<typeof attributeInputSchema>;
export type AttributeValueInput = z.infer<typeof attributeValueInputSchema>;
