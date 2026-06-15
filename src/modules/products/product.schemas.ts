import { z } from "zod";

const nullableText = (max = 5000) => z.string().trim().max(max).nullable().optional().transform((v) => v || null);
const nullableNumber = z.number().nonnegative().nullable().optional();
const slug = z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const nullableUrl = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => value || null)
  .refine((value) => value === null || /^https?:\/\/[^\s]+$/i.test(value), {
    message: "Enter a complete URL starting with http:// or https://.",
  });

export const variationSchema = z.object({
  id: z.string().uuid().optional(),
  sku: z.string().trim().min(1).max(100),
  regularPrice: z.number().nonnegative(),
  salePrice: nullableNumber,
  stockQuantity: z.number().int().nonnegative().default(0),
  lowStockThreshold: z.number().int().nonnegative().default(5),
  stockStatus: z.enum(["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK", "BACKORDER"]).default("IN_STOCK"),
  weight: nullableNumber, length: nullableNumber, width: nullableNumber, height: nullableNumber,
  imagePath: nullableText(500),
  isActive: z.boolean().default(true),
  attributeValueIds: z.array(z.string().uuid()).min(1),
}).superRefine((value, ctx) => {
  if (value.salePrice != null && value.salePrice >= value.regularPrice) ctx.addIssue({ code: "custom", path: ["salePrice"], message: "Sale price must be lower than regular price." });
});

export const productInputSchema = z.object({
  name: z.string().trim().min(2).max(255), slug, sku: nullableText(100),
  type: z.enum(["SIMPLE", "VARIABLE"]), status: z.enum(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"]),
  shortDescription: nullableText(500), description: nullableText(20000), brandId: z.string().uuid().nullable().optional(),
  gender: nullableText(30), isFeatured: z.boolean(), isNewArrival: z.boolean(),
  regularPrice: nullableNumber, salePrice: nullableNumber, saleStartsAt: z.string().datetime().nullable().optional(), saleEndsAt: z.string().datetime().nullable().optional(),
  costPrice: nullableNumber, isTaxable: z.boolean(), taxClass: nullableText(50),
  stockQuantity: z.number().int().nonnegative(), lowStockThreshold: z.number().int().nonnegative(),
  stockStatus: z.enum(["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK", "BACKORDER"]), allowBackorder: z.boolean(), maxOrderQuantity: z.number().int().positive().nullable().optional(),
  weight: nullableNumber, length: nullableNumber, width: nullableNumber, height: nullableNumber,
  shippingClass: nullableText(80), isFreeShipping: z.boolean(), isCodEligible: z.boolean(), dispatchDays: z.number().int().nonnegative().nullable().optional(),
  useGlobalPolicies: z.boolean(), shippingPolicy: nullableText(), returnPolicy: nullableText(), exchangePolicy: nullableText(), warrantyDetails: nullableText(),
  isReturnAllowed: z.boolean(), returnWindowDays: z.number().int().nonnegative().nullable().optional(),
  seoTitle: nullableText(70), metaDescription: nullableText(170), searchKeywords: z.array(z.string().trim().min(1)).default([]), canonicalUrl: nullableUrl,
  categoryIds: z.array(z.string().uuid()).default([]), tagNames: z.array(z.string().trim().min(1).max(50)).default([]),
  attributeIds: z.array(z.string().uuid()).default([]), variations: z.array(variationSchema).default([]),
}).superRefine((value, ctx) => {
  if (value.salePrice != null && value.regularPrice != null && value.salePrice >= value.regularPrice) ctx.addIssue({ code: "custom", path: ["salePrice"], message: "Sale price must be lower than regular price." });
  if (value.type === "SIMPLE" && (!value.sku || value.regularPrice == null)) ctx.addIssue({ code: "custom", path: ["sku"], message: "Simple products require SKU and regular price." });
});

export const bulkProductSchema = z.object({
  productIds: z.array(z.string().uuid()).min(1),
  action: z.enum(["ACTIVATE", "DEACTIVATE", "ARCHIVE", "DELETE", "UPDATE_CATEGORY"]),
  categoryId: z.string().uuid().optional(),
});

export const generateVariationsSchema = z.object({
  attributeValueGroups: z.array(z.array(z.string().uuid()).min(1)).min(1),
  skuPrefix: z.string().trim().min(1).max(50),
  regularPrice: z.number().nonnegative(),
  stockQuantity: z.number().int().nonnegative().default(0),
});

export type ProductInput = z.infer<typeof productInputSchema>;
