import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";

export type SiteLink = { label: string; url: string };
export type SocialLink = SiteLink & { platform: string };
export type SiteSettings = {
  brandName: string;
  headerLogoUrl: string;
  footerLogoUrl: string;
  footerDescription: string;
  quickLinksTitle: string;
  customerCareTitle: string;
  contactTitle: string;
  paymentMethodsTitle: string;
  email: string;
  phone: string;
  address: string;
  announcementItems: string[];
  socialLinks: SocialLink[];
  quickLinks: SiteLink[];
  customerCareLinks: SiteLink[];
  paymentMethods: string[];
  copyrightText: string;
  footerNote: string;
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  brandName: "SOLE VIBE",
  headerLogoUrl: "",
  footerLogoUrl: "",
  footerDescription: "Walk with confidence. Run with purpose. Engineered for performance and styled for modern streets.",
  quickLinksTitle: "Quick Links",
  customerCareTitle: "Customer Care",
  contactTitle: "Get in Touch",
  paymentMethodsTitle: "Accepted Payments",
  email: "hello@solevibe.com",
  phone: "+91 98765 43210",
  address: "Indiranagar Double Road, Bangalore, India",
  announcementItems: ["Free Shipping Over Rs. 999", "New Arrivals Weekly", "Easy 30-Day Returns", "100% Authentic Brands Only"],
  socialLinks: [
    { platform: "Instagram", label: "Instagram", url: "#" },
    { platform: "Facebook", label: "Facebook", url: "#" },
    { platform: "Twitter", label: "Twitter", url: "#" },
    { platform: "Youtube", label: "Youtube", url: "#" },
  ],
  quickLinks: [
    { label: "Home", url: "/" },
    { label: "Shop Catalogue", url: "/shop" },
    { label: "New Arrivals", url: "/shop" },
    { label: "Flash Sale", url: "/shop" },
  ],
  customerCareLinks: [
    { label: "Track Order", url: "/account" },
    { label: "Returns & Exchanges", url: "#" },
    { label: "Size Guidelines", url: "#" },
    { label: "Frequently Asked FAQs", url: "#" },
    { label: "Shipping Policy", url: "#" },
    { label: "Privacy & Data Policy", url: "#" },
  ],
  paymentMethods: ["Visa", "MasterCard", "UPI", "PayPal", "RazorPay"],
  copyrightText: "(c) 2026 SOLEVIBE Premium Store. All rights reserved.",
  footerNote: "Made with care in Bangalore, India",
};

const SETTINGS_KEY = "site_settings";

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

const text = (value: unknown, fallback = "") => typeof value === "string" ? value.trim() : fallback;
const textList = (value: unknown, fallback: string[], max: number) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()).slice(0, max) : fallback;
const links = (value: unknown, fallback: SiteLink[], max: number): SiteLink[] =>
  Array.isArray(value) ? value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const label = text(row.label);
    const url = text(row.url);
    return label && url ? [{ label, url }] : [];
  }).slice(0, max) : fallback;
const socials = (value: unknown): SocialLink[] =>
  Array.isArray(value) ? value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const platform = text(row.platform);
    const label = text(row.label, platform);
    const url = text(row.url);
    return platform && label && url ? [{ platform, label, url }] : [];
  }).slice(0, 12) : DEFAULT_SITE_SETTINGS.socialLinks;

function normalize(value: unknown): SiteSettings {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    brandName: text(row.brandName, DEFAULT_SITE_SETTINGS.brandName),
    headerLogoUrl: text(row.headerLogoUrl),
    footerLogoUrl: text(row.footerLogoUrl),
    footerDescription: text(row.footerDescription, DEFAULT_SITE_SETTINGS.footerDescription),
    quickLinksTitle: text(row.quickLinksTitle, DEFAULT_SITE_SETTINGS.quickLinksTitle),
    customerCareTitle: text(row.customerCareTitle, DEFAULT_SITE_SETTINGS.customerCareTitle),
    contactTitle: text(row.contactTitle, DEFAULT_SITE_SETTINGS.contactTitle),
    paymentMethodsTitle: text(row.paymentMethodsTitle, DEFAULT_SITE_SETTINGS.paymentMethodsTitle),
    email: text(row.email, DEFAULT_SITE_SETTINGS.email),
    phone: text(row.phone, DEFAULT_SITE_SETTINGS.phone),
    address: text(row.address, DEFAULT_SITE_SETTINGS.address),
    announcementItems: textList(row.announcementItems, DEFAULT_SITE_SETTINGS.announcementItems, 12),
    socialLinks: socials(row.socialLinks),
    quickLinks: links(row.quickLinks, DEFAULT_SITE_SETTINGS.quickLinks, 20),
    customerCareLinks: links(row.customerCareLinks, DEFAULT_SITE_SETTINGS.customerCareLinks, 20),
    paymentMethods: textList(row.paymentMethods, DEFAULT_SITE_SETTINGS.paymentMethods, 15),
    copyrightText: text(row.copyrightText, DEFAULT_SITE_SETTINGS.copyrightText),
    footerNote: text(row.footerNote, DEFAULT_SITE_SETTINGS.footerNote),
  };
}

export async function getSiteSettings() {
  await ensureSettingsTable();
  const [row] = await prisma.$queryRaw<Array<{ value: Prisma.JsonValue }>>`SELECT "value" FROM "app_settings" WHERE "setting_key"=${SETTINGS_KEY} LIMIT 1`;
  return normalize(row?.value);
}

export async function saveSiteSettings(input: SiteSettings) {
  await ensureSettingsTable();
  const settings = normalize(input);
  await prisma.$queryRaw`
    INSERT INTO "app_settings" ("id","setting_key","value","updated_at")
    VALUES (${randomUUID()}::uuid,${SETTINGS_KEY},${JSON.stringify(settings)}::jsonb,NOW())
    ON CONFLICT ("setting_key") DO UPDATE SET "value"=EXCLUDED."value","updated_at"=NOW()
  `;
  return settings;
}
