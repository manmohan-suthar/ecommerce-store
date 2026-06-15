import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { categoryMediaUpload, deleteUploadedFiles, uploadedFilePath } from "../../utils/local-upload.js";
import {
  categoryDeleteSchema,
  categoryInputSchema,
  categoryReorderSchema,
} from "./category.schemas.js";
import {
  createCategory,
  deleteCategory,
  listCategories,
  reorderCategories,
  updateCategory,
  updateCategoryStatus,
} from "./category.service.js";

export const categoryRouter = Router();

categoryRouter.use(requireAuth, requireAdmin);

categoryRouter.get(
  "/",
  asyncHandler(async (_request, response) => {
    response.json({ data: await listCategories() });
  }),
);

categoryRouter.post(
  "/",
  categoryMediaUpload,
  asyncHandler(async (request, response) => {
    try {
      const { removeImage: _removeImage, removeBanner: _removeBanner, ...body } = categoryInputSchema.parse(request.body);
      const files = request.files as Record<string, Express.Multer.File[]> | undefined;
      const input = {
        ...body,
        imageUrl: uploadedFilePath(files?.image?.[0]) ?? null,
        bannerUrl: uploadedFilePath(files?.banner?.[0]) ?? null,
      };
      response.status(201).json({ data: await createCategory(input) });
    } catch (error) {
      await deleteUploadedFiles(request.files as Record<string, Express.Multer.File[]> | undefined);
      throw error;
    }
  }),
);

categoryRouter.put(
  "/reorder",
  asyncHandler(async (request, response) => {
    const input = categoryReorderSchema.parse(request.body);
    response.json({ data: await reorderCategories(input.items) });
  }),
);

categoryRouter.put(
  "/:categoryId",
  categoryMediaUpload,
  asyncHandler(async (request, response) => {
    try {
      const categoryId = z.string().uuid().parse(request.params.categoryId);
      const { removeImage, removeBanner, ...body } = categoryInputSchema.parse(request.body);
      const files = request.files as Record<string, Express.Multer.File[]> | undefined;
      const input = {
        ...body,
        imageUrl: uploadedFilePath(files?.image?.[0]),
        bannerUrl: uploadedFilePath(files?.banner?.[0]),
      };
      response.json({ data: await updateCategory(categoryId, input, { removeImage, removeBanner }) });
    } catch (error) {
      await deleteUploadedFiles(request.files as Record<string, Express.Multer.File[]> | undefined);
      throw error;
    }
  }),
);

categoryRouter.patch(
  "/:categoryId/status",
  asyncHandler(async (request, response) => {
    const categoryId = z.string().uuid().parse(request.params.categoryId);
    const { isActive } = z.object({ isActive: z.boolean() }).parse(request.body);
    response.json({ data: await updateCategoryStatus(categoryId, isActive) });
  }),
);

categoryRouter.delete(
  "/:categoryId",
  asyncHandler(async (request, response) => {
    const categoryId = z.string().uuid().parse(request.params.categoryId);
    const { moveProductsToCategoryId } = categoryDeleteSchema.parse(request.body ?? {});
    await deleteCategory(categoryId, moveProductsToCategoryId);
    response.status(204).send();
  }),
);
