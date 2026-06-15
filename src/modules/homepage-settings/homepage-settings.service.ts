import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { normalizePublicProduct } from "../products/public-product.service.js";

export type HomepageHeroSettings = {
  enabled: boolean;
  badgeText: string;
  eyebrowText: string;
  headline: string;
  highlightedHeadline: string;
  description: string;
  primaryButtonText: string;
  secondaryButtonText: string;
  trustText: string;
  mobileProductBadge: string;
  productId: string | null;
};

const SETTINGS_KEY = "homepage_hero";
const TRENDING_SETTINGS_KEY = "homepage_trending";
const BRANDS_SETTINGS_KEY = "homepage_brands";
const DEFAULTS: HomepageHeroSettings = {
  enabled: true,
  badgeText: "New Collection",
  eyebrowText: "Spring Collection",
  headline: "Step Into",
  highlightedHeadline: "Next Level.",
  description: "Performance-ready sneakers designed to move all day and stand out everywhere.",
  primaryButtonText: "Shop Now",
  secondaryButtonText: "View Lookbook",
  trustText: "Trusted by 25,000+ sneaker lovers worldwide",
  mobileProductBadge: "New Drop",
  productId: null,
};

export type HomepageTrendingSettings = {
  enabled: boolean;
  eyebrowText: string;
  title: string;
  productIds: string[];
};

const TRENDING_DEFAULTS: HomepageTrendingSettings = {
  enabled: true,
  eyebrowText: "Elite Choice",
  title: "What Everyone's Wearing",
  productIds: [],
};

export type HomepageBrandsSettings = {
  enabled: boolean;
  title: string;
  brandIds: string[];
};

const BRANDS_DEFAULTS: HomepageBrandsSettings = {
  enabled: true,
  title: "Brands We Carry",
  brandIds: [],
};

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

function normalize(value: unknown): HomepageHeroSettings {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const text = (key: keyof HomepageHeroSettings) => typeof row[key] === "string" && String(row[key]).trim() ? String(row[key]).trim() : String(DEFAULTS[key] ?? "");
  return {
    enabled: typeof row.enabled === "boolean" ? row.enabled : DEFAULTS.enabled,
    badgeText: text("badgeText"),
    eyebrowText: text("eyebrowText"),
    headline: text("headline"),
    highlightedHeadline: text("highlightedHeadline"),
    description: text("description"),
    primaryButtonText: text("primaryButtonText"),
    secondaryButtonText: text("secondaryButtonText"),
    trustText: text("trustText"),
    mobileProductBadge: text("mobileProductBadge"),
    productId: typeof row.productId === "string" && row.productId ? row.productId : null,
  };
}

export async function getHomepageHeroSettings() {
  await ensureSettingsTable();
  const [row] = await prisma.$queryRaw<Array<{ value: Prisma.JsonValue }>>`SELECT "value" FROM "app_settings" WHERE "setting_key"=${SETTINGS_KEY} LIMIT 1`;
  return normalize(row?.value);
}

export async function saveHomepageHeroSettings(input: HomepageHeroSettings) {
  await ensureSettingsTable();
  const settings = normalize(input);
  await prisma.$queryRaw`
    INSERT INTO "app_settings" ("id","setting_key","value","updated_at")
    VALUES (${randomUUID()}::uuid,${SETTINGS_KEY},${JSON.stringify(settings)}::jsonb,NOW())
    ON CONFLICT ("setting_key") DO UPDATE SET "value"=EXCLUDED."value","updated_at"=NOW()
  `;
  return settings;
}

function normalizeTrending(value: unknown): HomepageTrendingSettings {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    enabled: typeof row.enabled === "boolean" ? row.enabled : TRENDING_DEFAULTS.enabled,
    eyebrowText: typeof row.eyebrowText === "string" && row.eyebrowText.trim() ? row.eyebrowText.trim() : TRENDING_DEFAULTS.eyebrowText,
    title: typeof row.title === "string" && row.title.trim() ? row.title.trim() : TRENDING_DEFAULTS.title,
    productIds: Array.isArray(row.productIds)
      ? [...new Set(row.productIds.filter((id): id is string => typeof id === "string" && id.length > 0))].slice(0, 12)
      : [],
  };
}

export async function getHomepageTrendingSettings() {
  await ensureSettingsTable();
  const [row] = await prisma.$queryRaw<Array<{ value: Prisma.JsonValue }>>`SELECT "value" FROM "app_settings" WHERE "setting_key"=${TRENDING_SETTINGS_KEY} LIMIT 1`;
  return normalizeTrending(row?.value);
}

export async function saveHomepageTrendingSettings(input: HomepageTrendingSettings) {
  await ensureSettingsTable();
  const settings = normalizeTrending(input);
  await prisma.$queryRaw`
    INSERT INTO "app_settings" ("id","setting_key","value","updated_at")
    VALUES (${randomUUID()}::uuid,${TRENDING_SETTINGS_KEY},${JSON.stringify(settings)}::jsonb,NOW())
    ON CONFLICT ("setting_key") DO UPDATE SET "value"=EXCLUDED."value","updated_at"=NOW()
  `;
  return settings;
}

function normalizeBrands(value: unknown): HomepageBrandsSettings {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    enabled: typeof row.enabled === "boolean" ? row.enabled : BRANDS_DEFAULTS.enabled,
    title: typeof row.title === "string" && row.title.trim() ? row.title.trim() : BRANDS_DEFAULTS.title,
    brandIds: Array.isArray(row.brandIds)
      ? [...new Set(row.brandIds.filter((id): id is string => typeof id === "string" && id.length > 0))].slice(0, 30)
      : [],
  };
}

export async function getHomepageBrandsSettings() {
  await ensureSettingsTable();
  const [row] = await prisma.$queryRaw<Array<{ value: Prisma.JsonValue }>>`SELECT "value" FROM "app_settings" WHERE "setting_key"=${BRANDS_SETTINGS_KEY} LIMIT 1`;
  return normalizeBrands(row?.value);
}

export async function saveHomepageBrandsSettings(input: HomepageBrandsSettings) {
  await ensureSettingsTable();
  const settings = normalizeBrands(input);
  await prisma.$queryRaw`
    INSERT INTO "app_settings" ("id","setting_key","value","updated_at")
    VALUES (${randomUUID()}::uuid,${BRANDS_SETTINGS_KEY},${JSON.stringify(settings)}::jsonb,NOW())
    ON CONFLICT ("setting_key") DO UPDATE SET "value"=EXCLUDED."value","updated_at"=NOW()
  `;
  return settings;
}

const productInclude = {
  brand: true,
  categoryAssignments: { include: { category: true } },
  tagAssignments: { include: { tag: true } },
  media: { orderBy: { displayOrder: "asc" as const } },
  variations: { include: { selections: { include: { attributeValue: { include: { attribute: true } } } } }, orderBy: { createdAt: "asc" as const } },
} as const;

export async function getPublicHomepageHero() {
  const settings = await getHomepageHeroSettings();
  const product = settings.productId
    ? await prisma.product.findFirst({ where: { id: settings.productId, status: "ACTIVE" }, include: productInclude })
    : await prisma.product.findFirst({ where: { status: "ACTIVE" }, include: productInclude, orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }] });
  return { ...settings, product: product ? normalizePublicProduct(product) : null };
}

export async function getPublicHomepageTrending() {
  const settings = await getHomepageTrendingSettings();
  const products = settings.productIds.length
    ? await prisma.product.findMany({ where: { id: { in: settings.productIds }, status: "ACTIVE" }, include: productInclude })
    : await prisma.product.findMany({
        where: { status: "ACTIVE" },
        include: productInclude,
        orderBy: [{ isFeatured: "desc" }, { isNewArrival: "desc" }, { createdAt: "desc" }],
        take: 5,
      });
  const orderedProducts = settings.productIds.length
    ? settings.productIds.map((id) => products.find((product) => product.id === id)).filter(Boolean)
    : products;
  return { ...settings, products: orderedProducts.map(normalizePublicProduct) };
}

export async function getPublicHomepageBrands() {
  const settings = await getHomepageBrandsSettings();
  const brands = await prisma.brand.findMany({
    where: settings.brandIds.length ? { id: { in: settings.brandIds }, isActive: true } : { isActive: true },
    ...(settings.brandIds.length ? {} : { orderBy: { name: "asc" as const } }),
    select: { id: true, name: true, slug: true },
  });
  const orderedBrands = settings.brandIds.length
    ? settings.brandIds.map((id) => brands.find((brand) => brand.id === id)).filter(Boolean)
    : brands;
  return { ...settings, brands: orderedBrands };
}
