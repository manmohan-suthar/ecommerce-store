import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  getHomepageHeroSettings,
  getHomepageBrandsSettings,
  getHomepageTrendingSettings,
  getPublicHomepageBrands,
  getPublicHomepageHero,
  getPublicHomepageTrending,
  saveHomepageHeroSettings,
  saveHomepageBrandsSettings,
  saveHomepageTrendingSettings,
} from "./homepage-settings.service.js";

const schema = z.object({
  enabled: z.boolean(),
  badgeText: z.string().trim().min(1).max(80),
  eyebrowText: z.string().trim().min(1).max(80),
  headline: z.string().trim().min(1).max(80),
  highlightedHeadline: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(300),
  primaryButtonText: z.string().trim().min(1).max(40),
  secondaryButtonText: z.string().trim().min(1).max(40),
  trustText: z.string().trim().min(1).max(120),
  mobileProductBadge: z.string().trim().min(1).max(40),
  productId: z.string().uuid().nullable(),
});

const trendingSchema = z.object({
  enabled: z.boolean(),
  eyebrowText: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(100),
  productIds: z.array(z.string().uuid()).max(12),
});

const brandsSchema = z.object({
  enabled: z.boolean(),
  title: z.string().trim().min(1).max(100),
  brandIds: z.array(z.string().uuid()).max(30),
});

export const homepageSettingsRouter = Router();
export const publicHomepageSettingsRouter = Router();
publicHomepageSettingsRouter.get("/hero", asyncHandler(async (_request, response) => response.json({ data: await getPublicHomepageHero() })));
publicHomepageSettingsRouter.get("/trending", asyncHandler(async (_request, response) => response.json({ data: await getPublicHomepageTrending() })));
publicHomepageSettingsRouter.get("/brands", asyncHandler(async (_request, response) => response.json({ data: await getPublicHomepageBrands() })));
homepageSettingsRouter.use(requireAuth, requireAdmin);
homepageSettingsRouter.get("/hero", asyncHandler(async (_request, response) => response.json({ data: await getHomepageHeroSettings() })));
homepageSettingsRouter.put("/hero", asyncHandler(async (request, response) => response.json({ data: await saveHomepageHeroSettings(schema.parse(request.body)) })));
homepageSettingsRouter.get("/trending", asyncHandler(async (_request, response) => response.json({ data: await getHomepageTrendingSettings() })));
homepageSettingsRouter.put("/trending", asyncHandler(async (request, response) => response.json({ data: await saveHomepageTrendingSettings(trendingSchema.parse(request.body)) })));
homepageSettingsRouter.get("/brands", asyncHandler(async (_request, response) => response.json({ data: await getHomepageBrandsSettings() })));
homepageSettingsRouter.put("/brands", asyncHandler(async (request, response) => response.json({ data: await saveHomepageBrandsSettings(brandsSchema.parse(request.body)) })));
