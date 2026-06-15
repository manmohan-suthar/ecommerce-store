import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getAdminOrder, listAdminOrders, updateOrderNotes, updateOrderShipping, updateOrderStatus } from "./orders.service.js";

export const adminOrdersRouter = Router();

adminOrdersRouter.use(requireAuth, requireAdmin);

adminOrdersRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const query = z
      .object({
        search: z.string().trim().optional(),
        status: z.string().trim().optional(),
        paymentStatus: z.string().trim().optional(),
      })
      .parse(request.query);

    response.json({ data: await listAdminOrders(query.search, query.status, query.paymentStatus) });
  }),
);

adminOrdersRouter.get(
  "/:orderId",
  asyncHandler(async (request, response) => {
    response.json({ data: await getAdminOrder(z.string().uuid().parse(request.params.orderId)) });
  }),
);

adminOrdersRouter.patch(
  "/:orderId/status",
  asyncHandler(async (request, response) => {
    const input = z.object({
      status: z.enum([
        "Pending",
        "Awaiting Payment Verification",
        "Confirmed",
        "Processing",
        "Packed",
        "Shipped",
        "Delivered",
        "Cancelled",
        "Return Requested",
        "Returned",
        "Refund Pending",
        "Refunded",
      ]),
      note: z.string().max(500).nullable().optional(),
    }).parse(request.body ?? {});

    response.json({
      data: await updateOrderStatus(z.string().uuid().parse(request.params.orderId), input.status, input.note ?? null),
    });
  }),
);

adminOrdersRouter.patch(
  "/:orderId/shipping",
  asyncHandler(async (request, response) => {
    const input = z.object({
      courierName: z.string().max(120).nullable().optional(),
      trackingId: z.string().max(120).nullable().optional(),
      trackingUrl: z.string().max(500).nullable().optional(),
      shippingDate: z.string().datetime().nullable().optional(),
      estimatedDeliveryDate: z.string().datetime().nullable().optional(),
    }).parse(request.body ?? {});

    response.json({
      data: await updateOrderShipping(z.string().uuid().parse(request.params.orderId), input),
    });
  }),
);

adminOrdersRouter.patch(
  "/:orderId/notes",
  asyncHandler(async (request, response) => {
    const input = z.object({
      adminNote: z.string().max(4000).nullable().optional(),
    }).parse(request.body ?? {});

    response.json({
      data: await updateOrderNotes(z.string().uuid().parse(request.params.orderId), input.adminNote ?? null),
    });
  }),
);
