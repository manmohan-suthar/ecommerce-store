import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  createRazorpayOrder,
  getPaymentGatewaySettings,
  getPublicPaymentGatewaySettings,
  savePaymentGatewaySettings,
  verifyRazorpayPayment,
} from "./payment-settings.service.js";

export const paymentSettingsRouter = Router();
export const publicPaymentSettingsRouter = Router();

publicPaymentSettingsRouter.get(
  "/config",
  asyncHandler(async (_request, response) => {
    response.json({ data: await getPublicPaymentGatewaySettings() });
  }),
);

publicPaymentSettingsRouter.post(
  "/razorpay/order",
  requireAuth,
  asyncHandler(async (request, response) => {
    const input = z
      .object({
        amount: z.number().positive(),
        currency: z.string().trim().optional(),
        receipt: z.string().trim().optional(),
        notes: z.record(z.any()).optional(),
      })
      .parse(request.body ?? {});

    response.status(201).json({ data: await createRazorpayOrder(input) });
  }),
);

publicPaymentSettingsRouter.post(
  "/razorpay/verify",
  requireAuth,
  asyncHandler(async (request, response) => {
    const input = z
      .object({
        razorpayOrderId: z.string().min(1),
        razorpayPaymentId: z.string().min(1),
        razorpaySignature: z.string().min(1),
      })
      .parse(request.body ?? {});

    response.json({ data: await verifyRazorpayPayment(input) });
  }),
);

paymentSettingsRouter.use(requireAuth, requireAdmin);

paymentSettingsRouter.get(
  "/",
  asyncHandler(async (_request, response) => {
    response.json({ data: await getPaymentGatewaySettings() });
  }),
);

paymentSettingsRouter.put(
  "/",
  asyncHandler(async (request, response) => {
    const input = z
      .object({
        enabled: z.boolean().optional(),
        keyId: z.string().trim().min(1).optional(),
        keySecret: z.string().trim().min(1).optional(),
        merchantName: z.string().trim().min(1).optional(),
        currency: z.string().trim().min(1).optional(),
      })
      .parse(request.body ?? {});

    response.json({ data: await savePaymentGatewaySettings(input) });
  }),
);
