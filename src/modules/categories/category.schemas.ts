import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => value || null);

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must use lowercase letters, numbers, and hyphens."),
  parentId: z.string().uuid().optional().nullable(),
  description: optionalText(300),
  displayOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.preprocess((value) => value === true || value === "true", z.boolean()).default(true),
  seoTitle: optionalText(70),
  seoDescription: optionalText(170),
  removeImage: z.preprocess((value) => value === true || value === "true", z.boolean()).default(false),
  removeBanner: z.preprocess((value) => value === true || value === "true", z.boolean()).default(false),
});

export const categoryReorderSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        displayOrder: z.number().int().min(0).max(9999),
      }),
    )
    .min(1),
});

export const categoryDeleteSchema = z.object({
  moveProductsToCategoryId: z.string().uuid().optional().nullable(),
});

export type CategoryInput = Omit<z.infer<typeof categoryInputSchema>, "removeImage" | "removeBanner"> & {
  imageUrl?: string | null;
  bannerUrl?: string | null;
};
