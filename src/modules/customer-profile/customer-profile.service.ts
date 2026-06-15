import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { HttpError } from "../../utils/http-error.js";

type ProfileState = {
  wishlist: string[];
  addresses: unknown[];
  orders: unknown[];
};

const emptyProfile = (): ProfileState => ({
  wishlist: [],
  addresses: [],
  orders: [],
});

type ProfileRow = {
  wishlist: Prisma.JsonValue;
  addresses: Prisma.JsonValue;
  orders: Prisma.JsonValue;
  is_blocked: boolean | null;
  blocked_reason: string | null;
  blocked_at: Date | string | null;
  admin_notes: string | null;
  used_promo_codes: Prisma.JsonValue;
  returns_refunds: Prisma.JsonValue;
};

let customerProfileTableReady: Promise<void> | null = null;

export function ensureCustomerProfilesTable() {
  if (!customerProfileTableReady) {
    customerProfileTableReady = (async () => {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "customer_profiles" (
          "id" UUID NOT NULL,
          "user_id" UUID NOT NULL,
          "wishlist" JSONB NOT NULL DEFAULT '[]'::jsonb,
          "addresses" JSONB NOT NULL DEFAULT '[]'::jsonb,
          "orders" JSONB NOT NULL DEFAULT '[]'::jsonb,
          "is_blocked" BOOLEAN NOT NULL DEFAULT FALSE,
          "blocked_reason" TEXT,
          "blocked_at" TIMESTAMP(3),
          "admin_notes" TEXT,
          "used_promo_codes" JSONB NOT NULL DEFAULT '[]'::jsonb,
          "returns_refunds" JSONB NOT NULL DEFAULT '[]'::jsonb,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "customer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `;

      await prisma.$executeRaw`
        ALTER TABLE "customer_profiles"
        ADD COLUMN IF NOT EXISTS "is_blocked" BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS "blocked_reason" TEXT,
        ADD COLUMN IF NOT EXISTS "blocked_at" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "admin_notes" TEXT,
        ADD COLUMN IF NOT EXISTS "used_promo_codes" JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS "returns_refunds" JSONB NOT NULL DEFAULT '[]'::jsonb
      `;

      await prisma.$executeRaw`
        CREATE UNIQUE INDEX IF NOT EXISTS "customer_profiles_user_id_key"
        ON "customer_profiles"("user_id")
      `;
    })().catch((error) => {
      customerProfileTableReady = null;
      throw error;
    });
  }

  return customerProfileTableReady;
}

function toArray<T>(value: Prisma.JsonValue | null | undefined): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toWishlistIds(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object" && "id" in item && typeof (item as { id?: unknown }).id === "string") {
            return (item as { id: string }).id;
          }
          return null;
        })
        .filter((item): item is string => Boolean(item)),
    ),
  );
}

export async function getCustomerProfile(userId: string) {
  await ensureCustomerProfilesTable();

  const [profile] = await prisma.$queryRaw<ProfileRow[]>`
    SELECT "wishlist", "addresses", "orders", "is_blocked", "blocked_reason", "blocked_at", "admin_notes", "used_promo_codes", "returns_refunds"
    FROM "customer_profiles"
    WHERE "user_id" = ${userId}::uuid
    LIMIT 1
  `;

  if (!profile) {
    return { userId, ...emptyProfile() };
  }

  return {
    userId,
    wishlist: toWishlistIds(profile.wishlist),
    addresses: toArray<unknown>(profile.addresses),
    orders: toArray<unknown>(profile.orders),
    isBlocked: Boolean(profile.is_blocked),
    blockedReason: profile.blocked_reason ?? null,
    blockedAt: profile.blocked_at ?? null,
    adminNotes: profile.admin_notes ?? null,
    usedPromoCodes: toArray<string>(profile.used_promo_codes),
    returnsRefunds: toArray<unknown>(profile.returns_refunds),
  };
}

export async function upsertCustomerProfile(userId: string, input: ProfileState) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(404, "User not found.");
  await ensureCustomerProfilesTable();

  const wishlist = JSON.stringify(Array.from(new Set(input.wishlist ?? [])));
  const addresses = JSON.stringify(input.addresses ?? []);
  const orders = JSON.stringify(input.orders ?? []);
  const id = randomUUID();

  const [profile] = await prisma.$queryRaw<ProfileRow[]>`
    INSERT INTO "customer_profiles" ("id", "user_id", "wishlist", "addresses", "orders", "updated_at")
    VALUES (${id}::uuid, ${userId}::uuid, ${wishlist}::jsonb, ${addresses}::jsonb, ${orders}::jsonb, NOW())
    ON CONFLICT ("user_id")
    DO UPDATE SET
      "wishlist" = EXCLUDED."wishlist",
      "addresses" = EXCLUDED."addresses",
      "orders" = EXCLUDED."orders",
      "updated_at" = NOW()
    RETURNING "wishlist", "addresses", "orders"
  `;

  return {
    userId,
    wishlist: toWishlistIds(profile?.wishlist),
    addresses: toArray<unknown>(profile?.addresses),
    orders: toArray<unknown>(profile?.orders),
    isBlocked: Boolean(profile?.is_blocked),
    blockedReason: profile?.blocked_reason ?? null,
    blockedAt: profile?.blocked_at ?? null,
    adminNotes: profile?.admin_notes ?? null,
    usedPromoCodes: toArray<string>(profile?.used_promo_codes),
    returnsRefunds: toArray<unknown>(profile?.returns_refunds),
  };
}
