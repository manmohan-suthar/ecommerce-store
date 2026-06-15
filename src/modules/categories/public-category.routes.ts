import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async-handler.js";
import { getPublicCategoryBySlug, listPublicCategories } from "./category.service.js";

export const publicCategoryRouter = Router();

publicCategoryRouter.get(
  "/",
  asyncHandler(async (_request, response) => {
    response.json({ data: await listPublicCategories() });
  }),
);

publicCategoryRouter.get(
  "/:slug",
  asyncHandler(async (request, response) => {
    const slug = z.string().trim().min(2).max(100).parse(request.params.slug);
    response.json({ data: await getPublicCategoryBySlug(slug) });
  }),
);
