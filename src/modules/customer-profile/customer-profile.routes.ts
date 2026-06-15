import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getCustomerProfile, upsertCustomerProfile } from "./customer-profile.service.js";

export const customerProfileRouter = Router();

const profilePayloadSchema = z.object({
  wishlist: z.array(z.string().uuid()).default([]),
  addresses: z.array(z.any()).default([]),
  orders: z.array(z.any()).default([]),
});

customerProfileRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (request, response) => {
    response.json({ data: await getCustomerProfile(request.user!.id) });
  }),
);

customerProfileRouter.put(
  "/me",
  requireAuth,
  asyncHandler(async (request, response) => {
    const payload = profilePayloadSchema.parse(request.body ?? {});
    response.json({ data: await upsertCustomerProfile(request.user!.id, payload) });
  }),
);
