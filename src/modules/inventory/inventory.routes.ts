import { Router } from "express";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { inventoryQuerySchema, movementQuerySchema, stockAdjustmentSchema } from "./inventory.schemas.js";
import { adjustStock, listInventory, listMovements } from "./inventory.service.js";

export const inventoryRouter = Router();
inventoryRouter.use(requireAuth, requireAdmin);

inventoryRouter.get("/", asyncHandler(async (request, response) => {
  response.json({ data: await listInventory(inventoryQuerySchema.parse(request.query)) });
}));

inventoryRouter.get("/movements", asyncHandler(async (request, response) => {
  const query = movementQuerySchema.parse(request.query);
  response.json({ data: await listMovements(query.productId, query.variationId, query.limit) });
}));

inventoryRouter.post("/adjustments", asyncHandler(async (request, response) => {
  const movement = await adjustStock(stockAdjustmentSchema.parse(request.body), request.user!.email);
  response.status(201).json({ data: movement });
}));
