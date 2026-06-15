import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getCustomerById, listCustomers, setCustomerAdminNotes, setCustomerStatus } from "./customers.service.js";

export const customersRouter = Router();

customersRouter.use(requireAuth, requireAdmin);

customersRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const query = z
      .object({
        search: z.string().trim().optional(),
        status: z.enum(["ALL", "ACTIVE", "BLOCKED"]).default("ALL"),
      })
      .parse(request.query);

    response.json({ data: await listCustomers(query.search, query.status) });
  }),
);

customersRouter.get(
  "/:userId",
  asyncHandler(async (request, response) => {
    response.json({ data: await getCustomerById(z.string().uuid().parse(request.params.userId)) });
  }),
);

customersRouter.patch(
  "/:userId/status",
  asyncHandler(async (request, response) => {
    const input = z
      .object({
        status: z.enum(["ACTIVE", "BLOCKED"]),
        reason: z.string().trim().max(500).nullable().optional(),
      })
      .parse(request.body ?? {});

    response.json({
      data: await setCustomerStatus(z.string().uuid().parse(request.params.userId), input.status, input.reason ?? null),
    });
  }),
);

customersRouter.patch(
  "/:userId/notes",
  asyncHandler(async (request, response) => {
    const input = z
      .object({
        adminNotes: z.string().trim().max(4000).nullable().optional(),
      })
      .parse(request.body ?? {});

    response.json({
      data: await setCustomerAdminNotes(z.string().uuid().parse(request.params.userId), input.adminNotes ?? null),
    });
  }),
);
