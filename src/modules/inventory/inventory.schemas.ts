import { z } from "zod";

export const inventoryQuerySchema = z.object({
  search: z.string().trim().max(150).optional(),
  categoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  stockStatus: z.enum(["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK", "BACKORDER"]).optional(),
});

export const movementQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  variationId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const stockAdjustmentSchema = z.object({
  productId: z.string().uuid(),
  variationId: z.string().uuid().nullable().optional(),
  movementType: z.enum(["INCREASE", "DECREASE", "SET"]),
  quantity: z.number().int().nonnegative(),
  reason: z.enum(["NEW_STOCK_RECEIVED", "DAMAGED_ITEM", "MANUAL_CORRECTION", "ORDER_CANCELLATION", "RETURN_RECEIVED"]),
  note: z.string().trim().max(500).nullable().optional().transform((value) => value || null),
}).superRefine((value, ctx) => {
  if (value.movementType !== "SET" && value.quantity === 0) {
    ctx.addIssue({ code: "custom", path: ["quantity"], message: "Quantity must be greater than zero." });
  }
});

export type InventoryQuery = z.infer<typeof inventoryQuerySchema>;
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
