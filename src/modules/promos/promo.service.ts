import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { HttpError } from "../../utils/http-error.js";
import { toPublicUrl } from "../../utils/public-url.js";

export type DiscountType = "FIXED_CART" | "PERCENTAGE" | "FIXED_PRODUCT" | "FREE_SHIPPING";
export type PromoInput = {
  code: string; description?: string | null; discountType: DiscountType; discountValue: number;
  maximumDiscountAmount?: number | null; minimumCartAmount: number; maximumCartAmount?: number | null;
  startsAt?: string | null; expiresAt?: string | null; totalUsageLimit?: number | null; perUserUsageLimit: number;
  perOrderUsageLimit: number; isActive: boolean; firstOrderOnly: boolean; newCustomersOnly: boolean;
  specificCustomerIds: string[]; includedCategoryIds: string[]; includedProductIds: string[];
  excludedCategoryIds: string[]; excludedProductIds: string[]; allowSaleProducts: boolean; allowCod: boolean; allowCombination: boolean;
};
export type PromoCartItem = { productId: string; quantity: number; unitPrice: number; lineTotal: number };

type PromoRow = {
  id: string; code: string; description: string | null; discount_type: DiscountType; discount_value: Prisma.Decimal;
  maximum_discount_amount: Prisma.Decimal | null; minimum_cart_amount: Prisma.Decimal; maximum_cart_amount: Prisma.Decimal | null;
  starts_at: Date | null; expires_at: Date | null; total_usage_limit: number | null; per_user_usage_limit: number;
  per_order_usage_limit: number; is_active: boolean; first_order_only: boolean; new_customers_only: boolean;
  specific_customer_ids: Prisma.JsonValue; included_category_ids: Prisma.JsonValue; included_product_ids: Prisma.JsonValue;
  excluded_category_ids: Prisma.JsonValue; excluded_product_ids: Prisma.JsonValue; allow_sale_products: boolean; allow_cod: boolean;
  allow_combination: boolean; created_at: Date; updated_at: Date;
};

let tablesReady: Promise<void> | null = null;
export function ensurePromoTables() {
  if (!tablesReady) tablesReady = (async () => {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "promo_codes" (
      "id" UUID PRIMARY KEY, "code" TEXT NOT NULL UNIQUE, "description" TEXT, "discount_type" TEXT NOT NULL,
      "discount_value" DECIMAL(12,2) NOT NULL DEFAULT 0, "maximum_discount_amount" DECIMAL(12,2),
      "minimum_cart_amount" DECIMAL(12,2) NOT NULL DEFAULT 0, "maximum_cart_amount" DECIMAL(12,2),
      "starts_at" TIMESTAMP(3), "expires_at" TIMESTAMP(3), "total_usage_limit" INTEGER, "per_user_usage_limit" INTEGER NOT NULL DEFAULT 1,
      "per_order_usage_limit" INTEGER NOT NULL DEFAULT 1, "is_active" BOOLEAN NOT NULL DEFAULT true,
      "first_order_only" BOOLEAN NOT NULL DEFAULT false, "new_customers_only" BOOLEAN NOT NULL DEFAULT false,
      "specific_customer_ids" JSONB NOT NULL DEFAULT '[]'::jsonb, "included_category_ids" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "included_product_ids" JSONB NOT NULL DEFAULT '[]'::jsonb, "excluded_category_ids" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "excluded_product_ids" JSONB NOT NULL DEFAULT '[]'::jsonb, "allow_sale_products" BOOLEAN NOT NULL DEFAULT true,
      "allow_cod" BOOLEAN NOT NULL DEFAULT true, "allow_combination" BOOLEAN NOT NULL DEFAULT false,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "promo_usage" (
      "id" UUID PRIMARY KEY, "promo_id" UUID NOT NULL REFERENCES "promo_codes"("id") ON DELETE CASCADE,
      "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE, "order_id" UUID NOT NULL,
      "code" TEXT NOT NULL, "discount_amount" DECIMAL(12,2) NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "promo_usage_promo_id_idx" ON "promo_usage"("promo_id")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "promo_usage_user_id_idx" ON "promo_usage"("user_id")`);
  })().catch((error) => { tablesReady = null; throw error; });
  return tablesReady;
}

const number = (value: unknown) => Number(value ?? 0);
const ids = (value: Prisma.JsonValue) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
function normalize(row: PromoRow, usageCount = 0) {
  return {
    id: row.id, code: row.code, description: row.description, discountType: row.discount_type, discountValue: number(row.discount_value),
    maximumDiscountAmount: row.maximum_discount_amount == null ? null : number(row.maximum_discount_amount),
    minimumCartAmount: number(row.minimum_cart_amount), maximumCartAmount: row.maximum_cart_amount == null ? null : number(row.maximum_cart_amount),
    startsAt: row.starts_at?.toISOString() ?? null, expiresAt: row.expires_at?.toISOString() ?? null, totalUsageLimit: row.total_usage_limit,
    perUserUsageLimit: row.per_user_usage_limit, perOrderUsageLimit: row.per_order_usage_limit, isActive: row.is_active,
    firstOrderOnly: row.first_order_only, newCustomersOnly: row.new_customers_only, specificCustomerIds: ids(row.specific_customer_ids),
    includedCategoryIds: ids(row.included_category_ids), includedProductIds: ids(row.included_product_ids),
    excludedCategoryIds: ids(row.excluded_category_ids), excludedProductIds: ids(row.excluded_product_ids),
    allowSaleProducts: row.allow_sale_products, allowCod: row.allow_cod, allowCombination: row.allow_combination,
    usageCount, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(),
  };
}

async function findByCode(code: string) {
  await ensurePromoTables();
  const [row] = await prisma.$queryRaw<PromoRow[]>`SELECT * FROM "promo_codes" WHERE "code" = ${code.trim().toUpperCase()} LIMIT 1`;
  return row;
}

export async function listPromos() {
  await ensurePromoTables();
  const rows = await prisma.$queryRaw<Array<PromoRow & { usage_count: bigint }>>`
    SELECT p.*, COUNT(u."id") AS usage_count FROM "promo_codes" p LEFT JOIN "promo_usage" u ON u."promo_id" = p."id"
    GROUP BY p."id" ORDER BY p."created_at" DESC
  `;
  return rows.map((row) => normalize(row, Number(row.usage_count)));
}

export async function getPromoMetadata() {
  const [products, categories, customers] = await Promise.all([
    prisma.product.findMany({ select: { id: true, name: true, media: { select: { path: true }, orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }], take: 1 } }, orderBy: { name: "asc" } }),
    prisma.category.findMany({ select: { id: true, name: true, imageUrl: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { role: "CUSTOMER" }, select: { id: true, name: true, email: true, avatarUrl: true }, orderBy: { createdAt: "desc" } }),
  ]);
  return {
    products: products.map((item) => ({ id: item.id, name: item.name, imageUrl: toPublicUrl(item.media[0]?.path) })),
    categories: categories.map((item) => ({ ...item, imageUrl: toPublicUrl(item.imageUrl) })),
    customers,
  };
}

export async function listPromoOptions(resource: "products" | "categories" | "customers", search: string, offset: number, limit: number) {
  const contains = search.trim();
  if (resource === "products") {
    const where = contains ? { name: { contains, mode: "insensitive" as const } } : {};
    const [items, total] = await prisma.$transaction([
      prisma.product.findMany({ where, select: { id: true, name: true, media: { select: { path: true }, orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }], take: 1 } }, orderBy: { name: "asc" }, skip: offset, take: limit }),
      prisma.product.count({ where }),
    ]);
    return { items: items.map((item) => ({ id: item.id, name: item.name, imageUrl: toPublicUrl(item.media[0]?.path) })), total, offset, limit };
  }
  if (resource === "categories") {
    const where = contains ? { name: { contains, mode: "insensitive" as const } } : {};
    const [items, total] = await prisma.$transaction([
      prisma.category.findMany({ where, select: { id: true, name: true, imageUrl: true }, orderBy: { name: "asc" }, skip: offset, take: limit }),
      prisma.category.count({ where }),
    ]);
    return { items: items.map((item) => ({ id: item.id, name: item.name, imageUrl: toPublicUrl(item.imageUrl) })), total, offset, limit };
  }
  const where = {
    role: "CUSTOMER" as const,
    ...(contains ? { OR: [{ name: { contains, mode: "insensitive" as const } }, { email: { contains, mode: "insensitive" as const } }] } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({ where, select: { id: true, name: true, email: true, avatarUrl: true }, orderBy: { createdAt: "desc" }, skip: offset, take: limit }),
    prisma.user.count({ where }),
  ]);
  return { items: items.map((item) => ({ id: item.id, name: item.name || item.email, subtitle: item.email, imageUrl: item.avatarUrl })), total, offset, limit };
}

export async function savePromo(input: PromoInput, promoId?: string) {
  await ensurePromoTables();
  const duplicate = await findByCode(input.code);
  if (duplicate && duplicate.id !== promoId) throw new HttpError(409, "Promo code already exists.");
  const payload = [input.specificCustomerIds, input.includedCategoryIds, input.includedProductIds, input.excludedCategoryIds, input.excludedProductIds].map((value) => JSON.stringify(value));
  if (promoId) {
    await prisma.$executeRaw`UPDATE "promo_codes" SET
      "code"=${input.code}, "description"=${input.description ?? null}, "discount_type"=${input.discountType}, "discount_value"=${input.discountValue},
      "maximum_discount_amount"=${input.maximumDiscountAmount ?? null}, "minimum_cart_amount"=${input.minimumCartAmount}, "maximum_cart_amount"=${input.maximumCartAmount ?? null},
      "starts_at"=${input.startsAt ?? null}::timestamptz, "expires_at"=${input.expiresAt ?? null}::timestamptz, "total_usage_limit"=${input.totalUsageLimit ?? null},
      "per_user_usage_limit"=${input.perUserUsageLimit}, "per_order_usage_limit"=${input.perOrderUsageLimit}, "is_active"=${input.isActive},
      "first_order_only"=${input.firstOrderOnly}, "new_customers_only"=${input.newCustomersOnly}, "specific_customer_ids"=${payload[0]}::jsonb,
      "included_category_ids"=${payload[1]}::jsonb, "included_product_ids"=${payload[2]}::jsonb, "excluded_category_ids"=${payload[3]}::jsonb,
      "excluded_product_ids"=${payload[4]}::jsonb, "allow_sale_products"=${input.allowSaleProducts}, "allow_cod"=${input.allowCod},
      "allow_combination"=${input.allowCombination}, "updated_at"=NOW() WHERE "id"=${promoId}::uuid`;
  } else {
    await prisma.$executeRaw`INSERT INTO "promo_codes" (
      "id","code","description","discount_type","discount_value","maximum_discount_amount","minimum_cart_amount","maximum_cart_amount","starts_at","expires_at",
      "total_usage_limit","per_user_usage_limit","per_order_usage_limit","is_active","first_order_only","new_customers_only","specific_customer_ids",
      "included_category_ids","included_product_ids","excluded_category_ids","excluded_product_ids","allow_sale_products","allow_cod","allow_combination"
    ) VALUES (${randomUUID()}::uuid,${input.code},${input.description ?? null},${input.discountType},${input.discountValue},${input.maximumDiscountAmount ?? null},
      ${input.minimumCartAmount},${input.maximumCartAmount ?? null},${input.startsAt ?? null}::timestamptz,${input.expiresAt ?? null}::timestamptz,${input.totalUsageLimit ?? null},
      ${input.perUserUsageLimit},${input.perOrderUsageLimit},${input.isActive},${input.firstOrderOnly},${input.newCustomersOnly},${payload[0]}::jsonb,${payload[1]}::jsonb,
      ${payload[2]}::jsonb,${payload[3]}::jsonb,${payload[4]}::jsonb,${input.allowSaleProducts},${input.allowCod},${input.allowCombination})`;
  }
  return normalize((await findByCode(input.code))!);
}

export async function deletePromo(id: string) { await ensurePromoTables(); await prisma.$executeRaw`DELETE FROM "promo_codes" WHERE "id"=${id}::uuid`; }

export async function validatePromo(userId: string, code: string, items: PromoCartItem[], shippingCharge = 0, paymentMethod?: string) {
  const row = await findByCode(code);
  if (!row || !row.is_active) throw new HttpError(400, "Promo code is invalid or inactive.");
  const promo = normalize(row);
  const now = new Date();
  if (row.starts_at && now < row.starts_at) throw new HttpError(400, "Promo code is not active yet.");
  if (row.expires_at && now > row.expires_at) throw new HttpError(400, "Promo code has expired.");
  if (paymentMethod === "COD" && !promo.allowCod) throw new HttpError(400, "This promo code is not valid for Cash on Delivery.");
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  if (subtotal < promo.minimumCartAmount) throw new HttpError(400, `Minimum cart amount is Rs. ${promo.minimumCartAmount}.`);
  if (promo.maximumCartAmount && subtotal > promo.maximumCartAmount) throw new HttpError(400, `Maximum cart amount is Rs. ${promo.maximumCartAmount}.`);
  const [orderCount, totalUsage, userUsage, productRows] = await Promise.all([
    prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "orders" WHERE "user_id"=${userId}::uuid`,
    prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "promo_usage" WHERE "promo_id"=${promo.id}::uuid`,
    prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "promo_usage" WHERE "promo_id"=${promo.id}::uuid AND "user_id"=${userId}::uuid`,
    prisma.product.findMany({ where: { id: { in: items.map((item) => item.productId) } }, select: { id: true, salePrice: true, categoryAssignments: { select: { categoryId: true } } } }),
  ]);
  if ((promo.firstOrderOnly || promo.newCustomersOnly) && Number(orderCount[0]?.count) > 0) throw new HttpError(400, "This promo code is valid for new customers on their first order only.");
  if (promo.specificCustomerIds.length && !promo.specificCustomerIds.includes(userId)) throw new HttpError(400, "This promo code is not assigned to your account.");
  if (promo.totalUsageLimit && Number(totalUsage[0]?.count) >= promo.totalUsageLimit) throw new HttpError(400, "Promo code usage limit has been reached.");
  if (Number(userUsage[0]?.count) >= promo.perUserUsageLimit) throw new HttpError(400, "You have already used this promo code the maximum allowed times.");
  const eligibleIds = new Set(productRows.filter((product) => {
    const categoryIds = product.categoryAssignments.map((item) => item.categoryId);
    if (!promo.allowSaleProducts && product.salePrice != null) return false;
    if (promo.excludedProductIds.includes(product.id) || categoryIds.some((id) => promo.excludedCategoryIds.includes(id))) return false;
    const hasIncludes = promo.includedProductIds.length > 0 || promo.includedCategoryIds.length > 0;
    return !hasIncludes || promo.includedProductIds.includes(product.id) || categoryIds.some((id) => promo.includedCategoryIds.includes(id));
  }).map((product) => product.id));
  const eligibleItems = items.filter((item) => eligibleIds.has(item.productId));
  if (!eligibleItems.length) throw new HttpError(400, "No cart products are eligible for this promo code.");
  const eligibleSubtotal = eligibleItems.reduce((sum, item) => sum + item.lineTotal, 0);
  let discount = promo.discountType === "PERCENTAGE" ? eligibleSubtotal * promo.discountValue / 100
    : promo.discountType === "FIXED_PRODUCT" ? eligibleItems.reduce((sum, item) => sum + Math.min(item.lineTotal, promo.discountValue * item.quantity), 0)
    : promo.discountType === "FIXED_CART" ? Math.min(subtotal, promo.discountValue) : 0;
  if (promo.maximumDiscountAmount) discount = Math.min(discount, promo.maximumDiscountAmount);
  discount = Math.round(discount);
  return { promoId: promo.id, code: promo.code, discount, freeShipping: promo.discountType === "FREE_SHIPPING", shippingDiscount: promo.discountType === "FREE_SHIPPING" ? shippingCharge : 0, eligibleProductIds: [...eligibleIds], message: `${promo.code} applied successfully.` };
}

export async function recordPromoUsage(promoId: string, userId: string, orderId: string, code: string, discount: number) {
  await ensurePromoTables();
  await prisma.$executeRaw`INSERT INTO "promo_usage" ("id","promo_id","user_id","order_id","code","discount_amount") VALUES (${randomUUID()}::uuid,${promoId}::uuid,${userId}::uuid,${orderId}::uuid,${code},${discount})`;
  await prisma.$executeRaw`
    UPDATE "customer_profiles"
    SET "used_promo_codes" = CASE
      WHEN COALESCE("used_promo_codes", '[]'::jsonb) @> ${JSON.stringify([code])}::jsonb THEN COALESCE("used_promo_codes", '[]'::jsonb)
      ELSE COALESCE("used_promo_codes", '[]'::jsonb) || ${JSON.stringify([code])}::jsonb
    END,
    "updated_at" = NOW()
    WHERE "user_id" = ${userId}::uuid
  `;
}

export async function listPromoUsage() {
  await ensurePromoTables();
  const rows = await prisma.$queryRaw<Array<{ id: string; code: string; discount_amount: Prisma.Decimal; created_at: Date; order_id: string; order_number: string; items: Prisma.JsonValue; user_id: string; name: string | null; email: string; avatar_url: string | null }>>`
    SELECT pu.*, o."order_number", o."items", u."name", u."email", u."avatar_url" FROM "promo_usage" pu
    JOIN "orders" o ON o."id"=pu."order_id" JOIN "users" u ON u."id"=pu."user_id" ORDER BY pu."created_at" DESC
  `;
  return rows.map((row) => ({ id: row.id, code: row.code, discountAmount: number(row.discount_amount), createdAt: row.created_at.toISOString(), orderId: row.order_id, orderNumber: row.order_number, items: Array.isArray(row.items) ? row.items : [], customer: { id: row.user_id, name: row.name, email: row.email, avatarUrl: row.avatar_url } }));
}
