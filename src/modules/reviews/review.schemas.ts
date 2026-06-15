import { ReviewStatus } from "@prisma/client";
import { z } from "zod";

export const reviewIdSchema = z.string().uuid();

export const createReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().min(2).max(120),
  text: z.string().trim().min(5).max(3000),
});

export const adminReviewFiltersSchema = z.object({
  search: z.string().trim().optional(),
  status: z.nativeEnum(ReviewStatus).optional(),
});

export const updateReviewSchema = z.object({
  status: z.nativeEnum(ReviewStatus).optional(),
  adminReply: z.string().trim().max(2000).nullable().optional(),
  isSpam: z.boolean().optional(),
});

export const reviewSettingsSchema = z.object({
  manualApprovalRequired: z.boolean().optional(),
  maxImageSizeMb: z.number().min(0.25).max(8).optional(),
  maxImages: z.number().int().min(0).max(5).optional(),
});
