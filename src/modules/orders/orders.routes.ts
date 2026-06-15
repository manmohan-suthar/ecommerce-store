import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { createOrder, listMyOrders } from "./orders.service.js";

export const ordersRouter = Router();

ordersRouter.use(requireAuth);

ordersRouter.get(
  "/me",
  asyncHandler(async (request, response) => {
    response.json({ data: await listMyOrders(request.user!.id) });
  }),
);

ordersRouter.post(
  "/",
  asyncHandler(async (request, response) => {
    const payload = z
      .object({
        items: z.array(z.object({
          id: z.string().min(1),
          productId: z.string().uuid(),
          productName: z.string().min(1),
          productSlug: z.string().min(1),
          productImage: z.string().url().or(z.string().min(1)),
          selectedSize: z.number().int().positive(),
          selectedColor: z.object({ name: z.string().min(1), value: z.string().min(1) }),
          quantity: z.number().int().positive(),
          unitPrice: z.number().nonnegative(),
          lineTotal: z.number().nonnegative(),
          variationId: z.string().uuid().nullable().optional(),
          sku: z.string().nullable().optional(),
        })).min(1),
        billingAddress: z.record(z.any()),
        shippingAddress: z.record(z.any()),
        shippingMethod: z.object({
          id: z.string().min(1),
          name: z.string().min(1),
          timeframe: z.string().min(1),
          price: z.number().nonnegative(),
        }),
        promoCode: z.string().min(1).nullable().optional(),
        customerNote: z.string().max(1000).nullable().optional(),
        paymentMethod: z.enum(["COD", "UPI", "CARD", "MANUAL"]).default("COD"),
      })
      .parse(request.body ?? {});

    response.status(201).json({ data: await createOrder(request.user!.id, payload) });
  }),
);
