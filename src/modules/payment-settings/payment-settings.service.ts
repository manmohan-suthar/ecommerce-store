import { randomUUID, createHmac } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { HttpError } from "../../utils/http-error.js";

type SettingsRow = {
  value: Prisma.JsonValue;
};

type PaymentGatewaySettings = {
  enabled: boolean;
  provider: "RAZORPAY";
  keyId: string;
  keySecret: string;
  merchantName: string;
  currency: string;
};

const SETTINGS_KEY = "payment_gateway";
const DEFAULT_SETTINGS: PaymentGatewaySettings = {
  enabled: true,
  provider: "RAZORPAY",
  keyId: "rzp_test_ShiaMK1t9B4YpI",
  keySecret: "J5rXpjqj6KRWYcuNqU2Owxgd",
  merchantName: "SoleVibe",
  currency: "INR",
};

let settingsTableReady: Promise<void> | null = null;

function ensureSettingsTable() {
  if (!settingsTableReady) {
    settingsTableReady = prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "app_settings" (
        "id" UUID NOT NULL,
        "setting_key" TEXT NOT NULL,
        "value" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
      )
    `.then(async () => {
      await prisma.$executeRaw`
        CREATE UNIQUE INDEX IF NOT EXISTS "app_settings_setting_key_key"
        ON "app_settings"("setting_key")
      `;
    }).catch((error) => {
      settingsTableReady = null;
      throw error;
    });
  }
  return settingsTableReady;
}

function toRecord(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function normalizeSettings(value: unknown): PaymentGatewaySettings {
  const record = toRecord(value as Prisma.JsonValue);
  return {
    enabled: typeof record.enabled === "boolean" ? record.enabled : DEFAULT_SETTINGS.enabled,
    provider: "RAZORPAY",
    keyId: typeof record.keyId === "string" && record.keyId.trim() ? record.keyId.trim() : DEFAULT_SETTINGS.keyId,
    keySecret: typeof record.keySecret === "string" && record.keySecret.trim() ? record.keySecret.trim() : DEFAULT_SETTINGS.keySecret,
    merchantName: typeof record.merchantName === "string" && record.merchantName.trim() ? record.merchantName.trim() : DEFAULT_SETTINGS.merchantName,
    currency: typeof record.currency === "string" && record.currency.trim() ? record.currency.trim().toUpperCase() : DEFAULT_SETTINGS.currency,
  };
}

export async function getPaymentGatewaySettings() {
  await ensureSettingsTable();
  const [row] = await prisma.$queryRaw<SettingsRow[]>`
    SELECT "value"
    FROM "app_settings"
    WHERE "setting_key" = ${SETTINGS_KEY}
    LIMIT 1
  `;
  return normalizeSettings(row?.value);
}

export async function getPublicPaymentGatewaySettings() {
  const settings = await getPaymentGatewaySettings();
  return {
    enabled: settings.enabled,
    provider: settings.provider,
    keyId: settings.keyId,
    merchantName: settings.merchantName,
    currency: settings.currency,
  };
}

export async function savePaymentGatewaySettings(input: Partial<PaymentGatewaySettings>) {
  await ensureSettingsTable();
  const current = await getPaymentGatewaySettings();
  const next: PaymentGatewaySettings = {
    ...current,
    ...input,
    provider: "RAZORPAY",
    keyId: input.keyId ?? current.keyId,
    keySecret: input.keySecret ?? current.keySecret,
    merchantName: input.merchantName ?? current.merchantName,
    currency: (input.currency ?? current.currency).toUpperCase(),
    enabled: typeof input.enabled === "boolean" ? input.enabled : current.enabled,
  };

  await prisma.$queryRaw`
    INSERT INTO "app_settings" ("id", "setting_key", "value", "updated_at")
    VALUES (${randomUUID()}::uuid, ${SETTINGS_KEY}, ${JSON.stringify(next)}::jsonb, NOW())
    ON CONFLICT ("setting_key")
    DO UPDATE SET
      "value" = EXCLUDED."value",
      "updated_at" = NOW()
  `;

  return next;
}

function toPaise(amount: number, currency: string) {
  const normalized = currency.toUpperCase();
  const multiplier = normalized === "INR" ? 100 : 100;
  return Math.max(1, Math.round(amount * multiplier));
}

export async function createRazorpayOrder(input: { amount: number; currency?: string; receipt?: string; notes?: Record<string, unknown> }) {
  const settings = await getPaymentGatewaySettings();
  if (!settings.enabled) throw new HttpError(400, "Razorpay is disabled.");

  const amount = toPaise(input.amount, input.currency ?? settings.currency);
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${settings.keyId}:${settings.keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency: (input.currency ?? settings.currency).toUpperCase(),
      receipt: input.receipt ?? `rcpt_${Date.now()}`,
      notes: input.notes ?? {},
    }),
  });

  if (!response.ok) {
    throw new HttpError(502, "Unable to create Razorpay order.");
  }

  return response.json();
}

export async function verifyRazorpayPayment(input: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) {
  const settings = await getPaymentGatewaySettings();
  const signed = createHmac("sha256", settings.keySecret)
    .update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`)
    .digest("hex");

  if (signed !== input.razorpaySignature) {
    throw new HttpError(400, "Invalid Razorpay signature.");
  }

  return { verified: true };
}
