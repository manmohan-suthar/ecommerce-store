import { Router } from "express";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { deleteUploadedFiles, reviewMediaUpload } from "../../utils/local-upload.js";
import { createReview, deleteReview, getReviewSettings, listAdminReviews, listLatestPublicReviews, listPublicReviews, saveReviewSettings, updateReview } from "./review.service.js";
import { adminReviewFiltersSchema, createReviewSchema, reviewIdSchema, reviewSettingsSchema, updateReviewSchema } from "./review.schemas.js";

export const reviewRouter = Router();
export const adminReviewRouter = Router();

reviewRouter.get("/settings", asyncHandler(async (_request, response) => response.json({ data: await getReviewSettings() })));
reviewRouter.get("/latest", asyncHandler(async (_request, response) => response.json({ data: await listLatestPublicReviews() })));
reviewRouter.get("/product/:productId", asyncHandler(async (request, response) => response.json({ data: await listPublicReviews(reviewIdSchema.parse(request.params.productId)) })));
reviewRouter.post("/product/:productId", requireAuth, reviewMediaUpload, asyncHandler(async (request, response) => {
  try {
    const input = createReviewSchema.parse(request.body);
    response.status(201).json({ data: await createReview(request.user!.id, reviewIdSchema.parse(request.params.productId), input, (request.files as Express.Multer.File[]) ?? []) });
  } catch (error) {
    await deleteUploadedFiles(request.files as Express.Multer.File[]);
    throw error;
  }
}));

adminReviewRouter.use(requireAuth, requireAdmin);
adminReviewRouter.get("/", asyncHandler(async (request, response) => {
  const query = adminReviewFiltersSchema.parse(request.query);
  response.json({ data: await listAdminReviews(query.search, query.status) });
}));
adminReviewRouter.patch("/:reviewId", asyncHandler(async (request, response) => {
  const input = updateReviewSchema.parse(request.body);
  response.json({ data: await updateReview(reviewIdSchema.parse(request.params.reviewId), input) });
}));
adminReviewRouter.delete("/:reviewId", asyncHandler(async (request, response) => {
  await deleteReview(reviewIdSchema.parse(request.params.reviewId));
  response.status(204).send();
}));
adminReviewRouter.get("/settings/config", asyncHandler(async (_request, response) => response.json({ data: await getReviewSettings() })));
adminReviewRouter.put("/settings/config", asyncHandler(async (request, response) => {
  const input = reviewSettingsSchema.parse(request.body);
  response.json({ data: await saveReviewSettings(input) });
}));
