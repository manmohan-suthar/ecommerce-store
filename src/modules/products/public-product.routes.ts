import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async-handler.js";
import { getPublicProductBySlug, listFreshDrops, listPublicProducts } from "./public-product.service.js";

export const publicProductRouter = Router();

publicProductRouter.get(
  "/",
  asyncHandler(async (_request, response) => {
    response.json({ data: await listPublicProducts() });
  }),
);

publicProductRouter.get(
  "/fresh-drops",
  asyncHandler(async (_request, response) => {
    response.json({ data: await listFreshDrops() });
  }),
);

publicProductRouter.get(
  "/:slug",
  asyncHandler(async (request, response) => {
    const slug = z.string().trim().min(2).max(120).parse(request.params.slug);
    response.json({ data: await getPublicProductBySlug(slug) });
  }),
);
