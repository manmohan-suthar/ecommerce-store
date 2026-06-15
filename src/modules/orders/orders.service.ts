import { randomUUID } from "node:crypto";
import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { HttpError } from "../../utils/http-error.js";
import { ensureCustomerProfilesTable } from "../customer-profile/customer-profile.service.js";
import { recordPromoUsage, validatePromo } from "../promos/promo.service.js";

export type OrderStatus =
  | "Pending"
  | "Awaiting Payment Verification"
  | "Confirmed"
  | "Processing"
  | "Packed"
  | "Shipped"
  | "Delivered"
  | "Cancelled"
  | "Return Requested"
  | "Returned"
  | "Refund Pending"
  | "Refunded";

export type PaymentStatus = "Pending" | "Paid" | "Failed" | "Refund Pending" | "Refunded";
export type ShippingStatus = "Pending" | "Processing" | "Packed" | "Shipped" | "Delivered" | "Returned";
export type PaymentMethod = "COD" | "UPI" | "CARD" | "MANUAL";

type OrderRow = {
  id: string;
  order_number: string;
  user_id: string;
  customer_avatar_url: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  billing_address: Prisma.JsonValue;
  shipping_address: Prisma.JsonValue;
  items: Prisma.JsonValue;
  subtotal: Prisma.JsonValue;
  discount: Prisma.JsonValue;
  shipping_charge: Prisma.JsonValue;
  tax_amount: Prisma.JsonValue;
  total: Prisma.JsonValue;
  shipping_method: Prisma.JsonValue;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  status: OrderStatus;
  shipping_status: ShippingStatus;
  promo_code: string | null;
  customer_note: string | null;
  admin_note: string | null;
  courier_name: string | null;
  tracking_id: string | null;
  tracking_url: string | null;
  shipping_date: Date | string | null;
  estimated_delivery_date: Date | string | null;
  status_history: Prisma.JsonValue;
  created_at: Date | string;
  updated_at: Date | string;
};

export interface OrderItemInput {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  productImage: string;
  selectedSize: number;
  selectedColor: { name: string; value: string };
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  variationId?: string | null;
  sku?: string | null;
}

export interface CreateOrderInput {
  items: OrderItemInput[];
  billingAddress: Record<string, unknown>;
  shippingAddress: Record<string, unknown>;
  shippingMethod: { id: string; name: string; timeframe: string; price: number };
  promoCode?: string | null;
  customerNote?: string | null;
  paymentMethod?: PaymentMethod;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAvatarUrl: string | null;
  date: string;
  orderDate: string;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  shippingStatus: ShippingStatus;
  shippingMethod: { id: string; name: string; timeframe: string; price: number };
  shippingDate: string | null;
  estimatedDeliveryDate: string | null;
  itemCount: number;
  promoCode: string | null;
  courierName: string | null;
  trackingId: string | null;
  trackingUrl: string | null;
}

export interface OrderDetail extends OrderSummary {
  customerId: string;
  billingAddress: Record<string, unknown>;
  shippingAddress: Record<string, unknown>;
  items: OrderItemInput[];
  subtotal: number;
  discount: number;
  shippingCharge: number;
  taxAmount: number;
  adminNote: string | null;
  customerNote: string | null;
  statusHistory: Array<{ status: OrderStatus; note?: string | null; createdAt: string; createdBy: "CUSTOMER" | "ADMIN" | "SYSTEM" }>;
}

let ordersTableReady: Promise<void> | null = null;

function ensureOrdersTable() {
  if (!ordersTableReady) {
    ordersTableReady = (async () => {
      await ensureCustomerProfilesTable();
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "orders" (
          "id" UUID NOT NULL,
          "order_number" TEXT NOT NULL,
          "user_id" UUID NOT NULL,
          "customer_name" TEXT NOT NULL,
          "customer_email" TEXT NOT NULL,
          "customer_phone" TEXT NOT NULL,
          "billing_address" JSONB NOT NULL,
          "shipping_address" JSONB NOT NULL,
          "items" JSONB NOT NULL,
          "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
          "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
          "shipping_charge" DECIMAL(12,2) NOT NULL DEFAULT 0,
          "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
          "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
          "shipping_method" JSONB NOT NULL DEFAULT '{}'::jsonb,
          "payment_method" TEXT NOT NULL DEFAULT 'COD',
          "payment_status" TEXT NOT NULL DEFAULT 'Pending',
          "status" TEXT NOT NULL DEFAULT 'Pending',
          "shipping_status" TEXT NOT NULL DEFAULT 'Pending',
          "promo_code" TEXT,
          "customer_note" TEXT,
          "admin_note" TEXT,
          "courier_name" TEXT,
          "tracking_id" TEXT,
          "tracking_url" TEXT,
          "shipping_date" TIMESTAMP(3),
          "estimated_delivery_date" TIMESTAMP(3),
          "status_history" JSONB NOT NULL DEFAULT '[]'::jsonb,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `;
      await prisma.$executeRaw`
        CREATE UNIQUE INDEX IF NOT EXISTS "orders_order_number_key"
        ON "orders"("order_number")
      `;
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "orders_user_id_created_at_idx"
        ON "orders"("user_id", "created_at")
      `;
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "orders_status_idx"
        ON "orders"("status")
      `;
      await prisma.$executeRaw`
        ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "shipping_method" JSONB NOT NULL DEFAULT '{}'::jsonb
      `;
    })().catch((error) => {
      ordersTableReady = null;
      throw error;
    });
  }

  return ordersTableReady;
}

function toNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toStringArray(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value) ? (value as string[]) : [];
}

function toRecord(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function summarize(row: OrderRow): OrderSummary {
  const items = Array.isArray(row.items) ? (row.items as OrderItemInput[]) : [];
  const shippingMethod = toRecord(row.shipping_method);
  return {
    id: row.id,
    orderNumber: row.order_number,
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    customerAvatarUrl: row.customer_avatar_url ?? null,
    date: toIso(row.created_at) ?? new Date().toISOString(),
    orderDate: toIso(row.created_at) ?? new Date().toISOString(),
    total: toNumber(row.total),
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    status: row.status,
    shippingStatus: row.shipping_status,
    shippingMethod: {
      id: (shippingMethod as { id?: string }).id ?? "manual",
      name: (shippingMethod as { name?: string }).name ?? "Manual Delivery",
      timeframe: (shippingMethod as { timeframe?: string }).timeframe ?? "Manual fulfillment",
      price: toNumber((shippingMethod as { price?: unknown }).price),
    },
    shippingDate: toIso(row.shipping_date),
    estimatedDeliveryDate: toIso(row.estimated_delivery_date),
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    promoCode: row.promo_code,
    courierName: row.courier_name,
    trackingId: row.tracking_id,
    trackingUrl: row.tracking_url,
  };
}

function detail(row: OrderRow): OrderDetail {
  const summary = summarize(row);
  return {
    ...summary,
    customerId: row.user_id,
    billingAddress: toRecord(row.billing_address),
    shippingAddress: toRecord(row.shipping_address),
    items: Array.isArray(row.items) ? (row.items as OrderItemInput[]) : [],
    subtotal: toNumber(row.subtotal),
    discount: toNumber(row.discount),
    shippingCharge: toNumber(row.shipping_charge),
    taxAmount: toNumber(row.tax_amount),
    adminNote: row.admin_note,
    customerNote: row.customer_note,
    statusHistory: Array.isArray(row.status_history)
      ? (row.status_history as Array<{ status: OrderStatus; note?: string | null; createdAt: string; createdBy: "CUSTOMER" | "ADMIN" | "SYSTEM" }>)
      : [],
  };
}

async function isCustomerBlocked(userId: string) {
  const [row] = await prisma.$queryRaw<Array<{ is_blocked: boolean | null }>>`
    SELECT "is_blocked"
    FROM "customer_profiles"
    WHERE "user_id" = ${userId}::uuid
    LIMIT 1
  `;
  return Boolean(row?.is_blocked);
}

async function getCustomerContact(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== UserRole.CUSTOMER) throw new HttpError(404, "Customer not found.");
  return user;
}

export async function createOrder(userId: string, input: CreateOrderInput) {
  await ensureOrdersTable();

  if (await isCustomerBlocked(userId)) {
    throw new HttpError(403, "Your account is blocked. Checkout is disabled.");
  }

  const user = await getCustomerContact(userId);
  const items = input.items ?? [];
  if (!items.length) throw new HttpError(400, "Order items are required.");

  const subtotal = items.reduce((sum, item) => sum + toNumber(item.lineTotal), 0);
  let shippingCharge = toNumber(input.shippingMethod?.price ?? 0);
  const promoResult = input.promoCode
    ? await validatePromo(userId, input.promoCode, items.map((item) => ({ productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice, lineTotal: item.lineTotal })), shippingCharge, input.paymentMethod ?? "COD")
    : null;
  const discount = promoResult?.discount ?? 0;
  if (promoResult?.freeShipping) shippingCharge = 0;
  const taxAmount = 0;
  const total = subtotal - discount + shippingCharge + taxAmount;
  const paymentMethod = input.paymentMethod ?? "COD";
  const isPaid = paymentMethod === "CARD" || paymentMethod === "UPI";
  const initialStatus: OrderStatus = isPaid ? "Confirmed" : "Pending";
  const initialPaymentStatus: PaymentStatus = isPaid ? "Paid" : "Pending";
  const now = new Date();
  const estimatedDeliveryDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  const orderNumber = `SV-${now.getFullYear()}-${Math.floor(Math.random() * 900000 + 100000)}`;
  const statusHistory = [
    { status: initialStatus, note: isPaid ? "Order paid successfully." : "Order created by customer.", createdAt: now.toISOString(), createdBy: "CUSTOMER" as const },
  ];

  const [row] = await prisma.$queryRaw<OrderRow[]>`
    INSERT INTO "orders" (
      "id",
      "order_number",
      "user_id",
      "customer_name",
      "customer_email",
      "customer_phone",
      "billing_address",
      "shipping_address",
      "items",
      "subtotal",
      "discount",
      "shipping_charge",
      "tax_amount",
      "total",
      "shipping_method",
      "payment_method",
      "payment_status",
      "status",
      "shipping_status",
      "promo_code",
      "customer_note",
      "status_history",
      "updated_at",
      "estimated_delivery_date"
    )
    VALUES (
      ${randomUUID()}::uuid,
      ${orderNumber},
      ${userId}::uuid,
      ${user.name ?? "Customer"},
      ${user.email},
      ${typeof input.shippingAddress?.phone === "string" ? input.shippingAddress.phone : ""},
      ${JSON.stringify(input.billingAddress)}::jsonb,
      ${JSON.stringify(input.shippingAddress)}::jsonb,
      ${JSON.stringify(items)}::jsonb,
      ${subtotal},
      ${discount},
      ${shippingCharge},
      ${taxAmount},
      ${total},
      ${JSON.stringify(input.shippingMethod)}::jsonb,
      ${paymentMethod},
      ${initialPaymentStatus},
      ${initialStatus},
      'Pending',
      ${promoResult?.code ?? null},
      ${input.customerNote ?? null},
      ${JSON.stringify(statusHistory)}::jsonb,
      NOW(),
      ${estimatedDeliveryDate.toISOString()}::timestamptz
    )
    RETURNING *
  `;

  await prisma.$executeRaw`
    UPDATE "customer_profiles"
    SET "orders" = COALESCE("orders", '[]'::jsonb) || ${JSON.stringify([detail(row)])}::jsonb,
        "updated_at" = NOW()
    WHERE "user_id" = ${userId}::uuid
  `;

  if (promoResult) {
    await recordPromoUsage(promoResult.promoId, userId, row.id, promoResult.code, discount + promoResult.shippingDiscount);
  }

  return detail({ ...row, customer_avatar_url: user.avatarUrl ?? null });
}

export async function listMyOrders(userId: string) {
  await ensureOrdersTable();
  const rows = await prisma.$queryRaw<OrderRow[]>`
    SELECT o.*, u."avatar_url" AS "customer_avatar_url"
    FROM "orders" o
    LEFT JOIN "users" u ON u."id" = o."user_id"
    WHERE o."user_id" = ${userId}::uuid
    ORDER BY "created_at" DESC
  `;
  return rows.map(detail);
}

export async function listAdminOrders(search?: string, status?: string, paymentStatus?: string) {
  await ensureOrdersTable();
  const term = search?.trim() ?? "";
  const rows = await prisma.$queryRaw<OrderRow[]>`
    SELECT o.*, u."avatar_url" AS "customer_avatar_url"
    FROM "orders" o
    LEFT JOIN "users" u ON u."id" = o."user_id"
    WHERE (
      ${term} = ''
      OR o."order_number" ILIKE ${`%${term}%`}
      OR o."customer_name" ILIKE ${`%${term}%`}
      OR o."customer_email" ILIKE ${`%${term}%`}
    )
    AND (${status ?? "ALL"} = 'ALL' OR o."status" = ${status ?? "ALL"})
    AND (${paymentStatus ?? "ALL"} = 'ALL' OR o."payment_status" = ${paymentStatus ?? "ALL"})
    ORDER BY o."created_at" DESC
  `;
  return rows.map(summarize);
}

export async function getAdminOrder(orderId: string) {
  await ensureOrdersTable();
  const [row] = await prisma.$queryRaw<OrderRow[]>`
    SELECT o.*, u."avatar_url" AS "customer_avatar_url"
    FROM "orders" o
    LEFT JOIN "users" u ON u."id" = o."user_id"
    WHERE o."id" = ${orderId}::uuid
    LIMIT 1
  `;
  if (!row) throw new HttpError(404, "Order not found.");
  return detail(row);
}

export async function updateOrderStatus(orderId: string, status: OrderStatus, note?: string | null) {
  await ensureOrdersTable();
  const existing = await getAdminOrder(orderId);
  const currentHistory = existing.statusHistory ?? [];
  const nextHistory = [...currentHistory, { status, note: note ?? null, createdAt: new Date().toISOString(), createdBy: "ADMIN" as const }];
  const shippingStatus: ShippingStatus =
    status === "Packed" || status === "Shipped" || status === "Delivered" ? status : existing.shippingStatus;
  const paymentStatus: PaymentStatus =
    status === "Confirmed" ? "Pending" : existing.paymentStatus;

  await prisma.$executeRaw`
    UPDATE "orders"
    SET "status" = ${status},
        "shipping_status" = ${shippingStatus},
        "payment_status" = ${paymentStatus},
        "admin_note" = ${note ?? existing.adminNote},
        "updated_at" = NOW(),
        "status_history" = ${JSON.stringify(nextHistory)}::jsonb
    WHERE "id" = ${orderId}::uuid
  `;
  return getAdminOrder(orderId);
}

export async function updateOrderShipping(orderId: string, input: { courierName?: string | null; trackingId?: string | null; trackingUrl?: string | null; shippingDate?: string | null; estimatedDeliveryDate?: string | null }) {
  await ensureOrdersTable();
  await prisma.$executeRaw`
    UPDATE "orders"
    SET
      "courier_name" = ${input.courierName ?? null},
      "tracking_id" = ${input.trackingId ?? null},
      "tracking_url" = ${input.trackingUrl ?? null},
      "shipping_date" = ${input.shippingDate ?? null}::timestamptz,
      "estimated_delivery_date" = ${input.estimatedDeliveryDate ?? null}::timestamptz,
      "shipping_status" = CASE
        WHEN ${input.shippingDate ?? null} IS NOT NULL THEN 'Shipped'
        ELSE "shipping_status"
      END,
      "status" = CASE
        WHEN ${input.shippingDate ?? null} IS NOT NULL THEN 'Shipped'
        ELSE "status"
      END,
      "updated_at" = NOW()
    WHERE "id" = ${orderId}::uuid
  `;
  return getAdminOrder(orderId);
}

export async function updateOrderNotes(orderId: string, note: string | null) {
  await ensureOrdersTable();
  await prisma.$executeRaw`
    UPDATE "orders"
    SET "admin_note" = ${note},
        "updated_at" = NOW()
    WHERE "id" = ${orderId}::uuid
  `;
  return getAdminOrder(orderId);
}
