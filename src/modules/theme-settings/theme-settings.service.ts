import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";

export type ThemeSettings = {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  success: string;
  danger: string;
};

export const DEFAULT_THEME: ThemeSettings = {
  primary: "#5B52E7",
  secondary: "#FF6B35",
  background: "#F5F6FA",
  surface: "#FFFFFF",
  text: "#111118",
  muted: "#6B6B80",
  border: "#E4E4EF",
  success: "#1CB87A",
  danger: "#E24B4A",
};

const SETTINGS_KEY = "storefront_theme";

async function ensureSettingsTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "app_settings" (
      "id" UUID NOT NULL, "setting_key" TEXT NOT NULL, "value" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
    )
  `;
  await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "app_settings_setting_key_key" ON "app_settings"("setting_key")`;
}

function normalize(value: unknown): ThemeSettings {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(Object.entries(DEFAULT_THEME).map(([key, fallback]) => {
    const candidate = row[key];
    return [key, typeof candidate === "string" && /^#[0-9a-f]{6}$/i.test(candidate) ? candidate.toUpperCase() : fallback];
  })) as unknown as ThemeSettings;
}

export async function getThemeSettings() {
  await ensureSettingsTable();
  const [row] = await prisma.$queryRaw<Array<{ value: Prisma.JsonValue }>>`SELECT "value" FROM "app_settings" WHERE "setting_key"=${SETTINGS_KEY} LIMIT 1`;
  return normalize(row?.value);
}

export async function saveThemeSettings(input: ThemeSettings) {
  await ensureSettingsTable();
  const settings = normalize(input);
  await prisma.$queryRaw`
    INSERT INTO "app_settings" ("id","setting_key","value","updated_at")
    VALUES (${randomUUID()}::uuid,${SETTINGS_KEY},${JSON.stringify(settings)}::jsonb,NOW())
    ON CONFLICT ("setting_key") DO UPDATE SET "value"=EXCLUDED."value","updated_at"=NOW()
  `;
  return settings;
}
