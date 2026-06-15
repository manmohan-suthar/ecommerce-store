import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getThemeSettings, saveThemeSettings } from "./theme-settings.service.js";

const color = z.string().regex(/^#[0-9A-F]{6}$/i, "Use a valid 6-digit hex color.");
const schema = z.object({
  primary: color, secondary: color, background: color, surface: color, text: color,
  muted: color, border: color, success: color, danger: color,
});

export const themeSettingsRouter = Router();
export const publicThemeSettingsRouter = Router();
publicThemeSettingsRouter.get("/", asyncHandler(async (_request, response) => response.json({ data: await getThemeSettings() })));
themeSettingsRouter.use(requireAuth, requireAdmin);
themeSettingsRouter.get("/", asyncHandler(async (_request, response) => response.json({ data: await getThemeSettings() })));
themeSettingsRouter.put("/", asyncHandler(async (request, response) => response.json({ data: await saveThemeSettings(schema.parse(request.body)) })));
