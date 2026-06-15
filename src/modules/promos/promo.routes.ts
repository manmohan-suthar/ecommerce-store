import { Router } from "express";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { deletePromo, getPromoMetadata, listPromoOptions, listPromos, listPromoUsage, savePromo, validatePromo } from "./promo.service.js";
import { promoIdSchema, promoInputSchema, promoOptionsQuerySchema, validatePromoSchema } from "./promo.schemas.js";

export const promoRouter = Router();
export const adminPromoRouter = Router();

promoRouter.post("/validate", requireAuth, asyncHandler(async (request, response) => {
  const input = validatePromoSchema.parse(request.body);
  response.json({ data: await validatePromo(request.user!.id, input.code, input.items, input.shippingCharge, input.paymentMethod) });
}));

adminPromoRouter.use(requireAuth, requireAdmin);
adminPromoRouter.get("/", asyncHandler(async (_request, response) => response.json({ data: await listPromos() })));
adminPromoRouter.get("/metadata", asyncHandler(async (_request, response) => response.json({ data: await getPromoMetadata() })));
adminPromoRouter.get("/options", asyncHandler(async (request, response) => {
  const query = promoOptionsQuerySchema.parse(request.query);
  response.json({ data: await listPromoOptions(query.resource, query.search, query.offset, query.limit) });
}));
adminPromoRouter.get("/usage", asyncHandler(async (_request, response) => response.json({ data: await listPromoUsage() })));
adminPromoRouter.post("/", asyncHandler(async (request, response) => response.status(201).json({ data: await savePromo(promoInputSchema.parse(request.body)) })));
adminPromoRouter.put("/:promoId", asyncHandler(async (request, response) => response.json({ data: await savePromo(promoInputSchema.parse(request.body), promoIdSchema.parse(request.params.promoId)) })));
adminPromoRouter.delete("/:promoId", asyncHandler(async (request, response) => { await deletePromo(promoIdSchema.parse(request.params.promoId)); response.status(204).send(); }));
