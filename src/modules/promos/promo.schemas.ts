import { z } from "zod";

export const promoIdSchema = z.string().uuid();
export const discountTypeSchema = z.enum(["FIXED_CART", "PERCENTAGE", "FIXED_PRODUCT", "FREE_SHIPPING"]);

export const promoInputSchema = z.object({
  code: z.string().trim().min(2).max(50).transform((value) => value.toUpperCase()),
  description: z.string().trim().max(500).nullable().optional(),
  discountType: discountTypeSchema,
  discountValue: z.number().nonnegative(),
  maximumDiscountAmount: z.number().nonnegative().nullable().optional(),
  minimumCartAmount: z.number().nonnegative().default(0),
  maximumCartAmount: z.number().positive().nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  totalUsageLimit: z.number().int().positive().nullable().optional(),
  perUserUsageLimit: z.number().int().positive().default(1),
  perOrderUsageLimit: z.number().int().positive().default(1),
  isActive: z.boolean().default(true),
  firstOrderOnly: z.boolean().default(false),
  newCustomersOnly: z.boolean().default(false),
  specificCustomerIds: z.array(z.string().uuid()).default([]),
  includedCategoryIds: z.array(z.string().uuid()).default([]),
  includedProductIds: z.array(z.string().uuid()).default([]),
  excludedCategoryIds: z.array(z.string().uuid()).default([]),
  excludedProductIds: z.array(z.string().uuid()).default([]),
  allowSaleProducts: z.boolean().default(true),
  allowCod: z.boolean().default(true),
  allowCombination: z.boolean().default(false),
}).superRefine((input, context) => {
  if (input.discountType === "PERCENTAGE" && input.discountValue > 100) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["discountValue"], message: "Percentage discount cannot exceed 100%." });
  }
  if (input.startsAt && input.expiresAt && new Date(input.startsAt) >= new Date(input.expiresAt)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["expiresAt"], message: "Expiry must be after the start date." });
  }
  if (input.maximumCartAmount != null && input.maximumCartAmount < input.minimumCartAmount) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["maximumCartAmount"], message: "Maximum cart amount must be greater than the minimum." });
  }
});

export const validatePromoSchema = z.object({
  code: z.string().trim().min(1),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().nonnegative(),
    lineTotal: z.number().nonnegative(),
  })).min(1),
  shippingCharge: z.number().nonnegative().default(0),
  paymentMethod: z.enum(["COD", "UPI", "CARD", "MANUAL"]).optional(),
});

export const promoOptionsQuerySchema = z.object({
  resource: z.enum(["products", "categories", "customers"]),
  search: z.string().trim().max(120).default(""),
  offset: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});
