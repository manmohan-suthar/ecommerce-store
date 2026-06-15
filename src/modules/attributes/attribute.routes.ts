import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { attributeInputSchema, attributeValueInputSchema, reorderSchema, statusSchema } from "./attribute.schemas.js";
import {
  createAttribute,
  createAttributeValue,
  deleteAttribute,
  deleteAttributeValue,
  listAttributes,
  reorderAttributes,
  reorderAttributeValues,
  updateAttribute,
  updateAttributeStatus,
  updateAttributeValue,
  updateAttributeValueStatus,
} from "./attribute.service.js";

export const attributeRouter = Router();
attributeRouter.use(requireAuth, requireAdmin);

attributeRouter.get("/", asyncHandler(async (_request, response) => response.json({ data: await listAttributes() })));
attributeRouter.post("/", asyncHandler(async (request, response) => response.status(201).json({ data: await createAttribute(attributeInputSchema.parse(request.body)) })));
attributeRouter.put("/reorder", asyncHandler(async (request, response) => response.json({ data: await reorderAttributes(reorderSchema.parse(request.body).items) })));
attributeRouter.put("/:attributeId", asyncHandler(async (request, response) => response.json({ data: await updateAttribute(z.string().uuid().parse(request.params.attributeId), attributeInputSchema.parse(request.body)) })));
attributeRouter.patch("/:attributeId/status", asyncHandler(async (request, response) => response.json({ data: await updateAttributeStatus(z.string().uuid().parse(request.params.attributeId), statusSchema.parse(request.body).isActive) })));
attributeRouter.delete("/:attributeId", asyncHandler(async (request, response) => {
  await deleteAttribute(z.string().uuid().parse(request.params.attributeId));
  response.status(204).send();
}));

attributeRouter.post("/:attributeId/values", asyncHandler(async (request, response) => response.status(201).json({ data: await createAttributeValue(z.string().uuid().parse(request.params.attributeId), attributeValueInputSchema.parse(request.body)) })));
attributeRouter.put("/:attributeId/values/reorder", asyncHandler(async (request, response) => {
  const attributeId = z.string().uuid().parse(request.params.attributeId);
  await reorderAttributeValues(attributeId, reorderSchema.parse(request.body).items);
  response.status(204).send();
}));
attributeRouter.put("/values/:valueId", asyncHandler(async (request, response) => response.json({ data: await updateAttributeValue(z.string().uuid().parse(request.params.valueId), attributeValueInputSchema.parse(request.body)) })));
attributeRouter.patch("/values/:valueId/status", asyncHandler(async (request, response) => response.json({ data: await updateAttributeValueStatus(z.string().uuid().parse(request.params.valueId), statusSchema.parse(request.body).isActive) })));
attributeRouter.delete("/values/:valueId", asyncHandler(async (request, response) => {
  await deleteAttributeValue(z.string().uuid().parse(request.params.valueId));
  response.status(204).send();
}));
