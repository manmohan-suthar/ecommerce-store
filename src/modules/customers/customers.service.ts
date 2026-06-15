import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { HttpError } from "../../utils/http-error.js";
import { ensureCustomerProfilesTable } from "../customer-profile/customer-profile.service.js";

type JsonArray = Prisma.JsonValue;

type CustomerRow = {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at: Date;
  is_blocked: boolean | null;
  blocked_reason: string | null;
  blocked_at: Date | string | null;
  admin_notes: string | null;
  wishlist: JsonArray;
  addresses: JsonArray;
  orders: JsonArray;
  used_promo_codes: JsonArray;
  returns_refunds: JsonArray;
};

export type CustomerSummary = {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  phone: string | null;
  registrationDate: string;
  totalOrders: number;
  totalAmountSpent: number;
  usedPromoCodes: string[];
  returnsRefunds: unknown[];
  status: "ACTIVE" | "BLOCKED";
  adminNotes: string | null;
  addresses: unknown[];
  orderHistory: unknown[];
  wishlistCount: number;
  lastOrderDate: string | null;
  blockedReason: string | null;
  blockedAt: string | null;
};

function toArray<T>(value: Prisma.JsonValue | null | undefined): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstPhone(addresses: unknown[], orders: unknown[]) {
  for (const address of addresses) {
    if (address && typeof address === "object" && "phone" in address) {
      const phone = (address as { phone?: unknown }).phone;
      if (typeof phone === "string" && phone.trim()) return phone;
    }
  }
  for (const order of orders) {
    const addr = order && typeof order === "object" && "address" in order ? (order as { address?: unknown }).address : null;
    if (addr && typeof addr === "object" && "phone" in addr) {
      const phone = (addr as { phone?: unknown }).phone;
      if (typeof phone === "string" && phone.trim()) return phone;
    }
  }
  return null;
}

function summarizeCustomer(row: CustomerRow): CustomerSummary {
  const addresses = toArray<unknown>(row.addresses);
  const orders = toArray<unknown>(row.orders);
  const usedPromoCodes = Array.from(
    new Set([
      ...toArray<string>(row.used_promo_codes),
      ...orders.flatMap((order) => {
        if (!order || typeof order !== "object") return [];
        const promoCode = "promoCode" in order ? (order as { promoCode?: unknown }).promoCode : null;
        return typeof promoCode === "string" && promoCode.trim() ? [promoCode] : [];
      }),
    ]),
  );
  const orderHistory = orders;
  const totalAmountSpent = orders.reduce((sum, order) => {
    if (!order || typeof order !== "object") return sum;
    const total = "total" in order ? (order as { total?: unknown }).total : 0;
    return sum + toNumber(total);
  }, 0);
  const lastOrderDate = orders
    .map((order) => {
      if (!order || typeof order !== "object") return null;
      const date = "date" in order ? (order as { date?: unknown }).date : null;
      return typeof date === "string" ? date : null;
    })
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1) ?? null;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatar_url,
    phone: firstPhone(addresses, orders),
    registrationDate: toIso(row.created_at) ?? new Date().toISOString(),
    totalOrders: orders.length,
    totalAmountSpent,
    usedPromoCodes,
    returnsRefunds: toArray<unknown>(row.returns_refunds),
    status: row.is_blocked ? "BLOCKED" : "ACTIVE",
    adminNotes: row.admin_notes ?? null,
    addresses,
    orderHistory,
    wishlistCount: toArray<unknown>(row.wishlist).length,
    lastOrderDate,
    blockedReason: row.blocked_reason ?? null,
    blockedAt: toIso(row.blocked_at),
  };
}

export async function listCustomers(search?: string, status?: "ALL" | "ACTIVE" | "BLOCKED") {
  await ensureCustomerProfilesTable();
  const term = search?.trim();
  const rows = await prisma.$queryRaw<CustomerRow[]>`
    SELECT
      u."id",
      u."email",
      u."name",
      u."avatar_url",
      u."created_at",
      cp."is_blocked",
      cp."blocked_reason",
      cp."blocked_at",
      cp."admin_notes",
      COALESCE(cp."wishlist", '[]'::jsonb) AS "wishlist",
      COALESCE(cp."addresses", '[]'::jsonb) AS "addresses",
      COALESCE(cp."orders", '[]'::jsonb) AS "orders",
      COALESCE(cp."used_promo_codes", '[]'::jsonb) AS "used_promo_codes",
      COALESCE(cp."returns_refunds", '[]'::jsonb) AS "returns_refunds"
    FROM "users" u
    LEFT JOIN "customer_profiles" cp ON cp."user_id" = u."id"
    WHERE u."role" = 'CUSTOMER'
      AND (
        ${term ?? ""} = ''
        OR u."name" ILIKE ${`%${term ?? ""}%`}
        OR u."email" ILIKE ${`%${term ?? ""}%`}
      )
      AND (
        ${status ?? "ALL"} = 'ALL'
        OR (${status ?? "ALL"} = 'ACTIVE' AND COALESCE(cp."is_blocked", false) = false)
        OR (${status ?? "ALL"} = 'BLOCKED' AND COALESCE(cp."is_blocked", false) = true)
      )
    ORDER BY u."created_at" DESC
  `;

  return rows.map(summarizeCustomer);
}

export async function getCustomerById(userId: string) {
  await ensureCustomerProfilesTable();
  const [row] = await prisma.$queryRaw<CustomerRow[]>`
    SELECT
      u."id",
      u."email",
      u."name",
      u."avatar_url",
      u."created_at",
      cp."is_blocked",
      cp."blocked_reason",
      cp."blocked_at",
      cp."admin_notes",
      COALESCE(cp."wishlist", '[]'::jsonb) AS "wishlist",
      COALESCE(cp."addresses", '[]'::jsonb) AS "addresses",
      COALESCE(cp."orders", '[]'::jsonb) AS "orders",
      COALESCE(cp."used_promo_codes", '[]'::jsonb) AS "used_promo_codes",
      COALESCE(cp."returns_refunds", '[]'::jsonb) AS "returns_refunds"
    FROM "users" u
    LEFT JOIN "customer_profiles" cp ON cp."user_id" = u."id"
    WHERE u."role" = 'CUSTOMER'
      AND u."id" = ${userId}::uuid
    LIMIT 1
  `;

  if (!row) throw new HttpError(404, "Customer not found.");
  return summarizeCustomer(row);
}

export async function setCustomerStatus(userId: string, status: "ACTIVE" | "BLOCKED", reason?: string | null) {
  await ensureCustomerProfilesTable();
  await prisma.$executeRaw`
    INSERT INTO "customer_profiles" ("id", "user_id", "is_blocked", "blocked_reason", "blocked_at", "updated_at")
    VALUES (
      ${randomUUID()}::uuid,
      ${userId}::uuid,
      ${status === "BLOCKED"},
      ${reason ?? null},
      CASE WHEN ${status === "BLOCKED"} THEN NOW() ELSE NULL END,
      NOW()
    )
    ON CONFLICT ("user_id")
    DO UPDATE SET
      "is_blocked" = EXCLUDED."is_blocked",
      "blocked_reason" = EXCLUDED."blocked_reason",
      "blocked_at" = EXCLUDED."blocked_at",
      "updated_at" = NOW()
  `;
  return getCustomerById(userId);
}

export async function setCustomerAdminNotes(userId: string, adminNotes: string | null) {
  await ensureCustomerProfilesTable();
  await prisma.$executeRaw`
    INSERT INTO "customer_profiles" ("id", "user_id", "admin_notes", "updated_at")
    VALUES (${randomUUID()}::uuid, ${userId}::uuid, ${adminNotes}, NOW())
    ON CONFLICT ("user_id")
    DO UPDATE SET
      "admin_notes" = EXCLUDED."admin_notes",
      "updated_at" = NOW()
  `;
  return getCustomerById(userId);
}
