import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { brandingMediaUpload, uploadedBrandingFilePath } from "../../utils/local-upload.js";
import { toPublicUrl } from "../../utils/public-url.js";
import { getSiteSettings, saveSiteSettings } from "./site-settings.service.js";

const safeLink = z.string().trim().min(1).max(500).refine(
  (value) => value.startsWith("/") || value.startsWith("#") || /^https?:\/\//i.test(value) || /^(mailto|tel):/i.test(value),
  "Use an internal path, anchor, HTTP URL, mailto, or tel link.",
);
const linkSchema = z.object({ label: z.string().trim().min(1).max(80), url: safeLink });
const schema = z.object({
  brandName: z.string().trim().min(1).max(80),
  headerLogoUrl: z.string().trim().max(1000),
  footerLogoUrl: z.string().trim().max(1000),
  footerDescription: z.string().trim().min(1).max(500),
  quickLinksTitle: z.string().trim().min(1).max(80),
  customerCareTitle: z.string().trim().min(1).max(80),
  contactTitle: z.string().trim().min(1).max(80),
  paymentMethodsTitle: z.string().trim().min(1).max(80),
  email: z.string().trim().max(160),
  phone: z.string().trim().max(80),
  address: z.string().trim().max(300),
  announcementItems: z.array(z.string().trim().min(1).max(120)).max(12),
  socialLinks: z.array(linkSchema.extend({ platform: z.string().trim().min(1).max(40) })).max(12),
  quickLinks: z.array(linkSchema).max(20),
  customerCareLinks: z.array(linkSchema).max(20),
  paymentMethods: z.array(z.string().trim().min(1).max(40)).max(15),
  copyrightText: z.string().trim().min(1).max(200),
  footerNote: z.string().trim().max(200),
});

export const publicSiteSettingsRouter = Router();
export const siteSettingsRouter = Router();

publicSiteSettingsRouter.get("/", asyncHandler(async (_request, response) => response.json({ data: await getSiteSettings() })));
siteSettingsRouter.use(requireAuth, requireAdmin);
siteSettingsRouter.get("/", asyncHandler(async (_request, response) => response.json({ data: await getSiteSettings() })));
siteSettingsRouter.put("/", asyncHandler(async (request, response) => response.json({ data: await saveSiteSettings(schema.parse(request.body)) })));
siteSettingsRouter.post("/logo", brandingMediaUpload, asyncHandler(async (request, response) => {
  if (!request.file) return response.status(400).json({ message: "Select an image to upload." });
  response.status(201).json({ data: { url: toPublicUrl(uploadedBrandingFilePath(request.file)) } });
}));
