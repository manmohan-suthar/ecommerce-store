import { randomUUID } from "node:crypto";
import { Prisma, ReviewStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { deleteLocalUpload } from "../../utils/local-upload.js";
import { HttpError } from "../../utils/http-error.js";
import { toPublicUrl } from "../../utils/public-url.js";

export type ReviewSettings = {
  manualApprovalRequired: boolean;
  maxImageSizeMb: number;
  maxImages: number;
};

const SETTINGS_KEY = "reviews";
const DEFAULT_SETTINGS: ReviewSettings = { manualApprovalRequired: true, maxImageSizeMb: 1, maxImages: 3 };
let reviewTableReady: Promise<void> | null = null;

function ensureReviewTable() {
  if (!reviewTableReady) {
    reviewTableReady = (async () => {
      await prisma.$executeRawUnsafe(`
        DO $$ BEGIN
          CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'HIDDEN');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "reviews" (
          "id" UUID NOT NULL, "user_id" UUID NOT NULL, "product_id" UUID NOT NULL,
          "rating" INTEGER NOT NULL, "title" TEXT NOT NULL, "text" TEXT NOT NULL,
          "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "verified_purchase" BOOLEAN NOT NULL DEFAULT false,
          "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING', "admin_reply" TEXT, "is_spam" BOOLEAN NOT NULL DEFAULT false,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "reviews_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `);
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "reviews_user_id_product_id_key" ON "reviews"("user_id", "product_id")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "reviews_product_id_status_created_at_idx" ON "reviews"("product_id", "status", "created_at")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "reviews_status_created_at_idx" ON "reviews"("status", "created_at")`);
    })().catch((error) => {
      reviewTableReady = null;
      throw error;
    });
  }
  return reviewTableReady;
}

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

function normalizeSettings(value: unknown): ReviewSettings {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    manualApprovalRequired: typeof row.manualApprovalRequired === "boolean" ? row.manualApprovalRequired : true,
    maxImageSizeMb: typeof row.maxImageSizeMb === "number" ? Math.min(8, Math.max(0.25, row.maxImageSizeMb)) : 1,
    maxImages: typeof row.maxImages === "number" ? Math.min(5, Math.max(0, Math.round(row.maxImages))) : 3,
  };
}

export async function getReviewSettings() {
  await ensureSettingsTable();
  const [row] = await prisma.$queryRaw<Array<{ value: Prisma.JsonValue }>>`
    SELECT "value" FROM "app_settings" WHERE "setting_key" = ${SETTINGS_KEY} LIMIT 1
  `;
  return normalizeSettings(row?.value);
}

export async function saveReviewSettings(input: Partial<ReviewSettings>) {
  const next = normalizeSettings({ ...(await getReviewSettings()), ...input });
  await prisma.$queryRaw`
    INSERT INTO "app_settings" ("id", "setting_key", "value", "updated_at")
    VALUES (${randomUUID()}::uuid, ${SETTINGS_KEY}, ${JSON.stringify(next)}::jsonb, NOW())
    ON CONFLICT ("setting_key") DO UPDATE SET "value" = EXCLUDED."value", "updated_at" = NOW()
  `;
  return next;
}

const include = {
  user: { select: { id: true, name: true, email: true, avatarUrl: true } },
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      media: { select: { path: true }, orderBy: [{ isPrimary: "desc" as const }, { displayOrder: "asc" as const }], take: 1 },
    },
  },
} as const;

function normalizeReview(review: any) {
  const { media, ...product } = review.product;
  return {
    ...review,
    images: review.images.map((image: string) => toPublicUrl(image)),
    customer: review.user,
    product: { ...product, imageUrl: toPublicUrl(media[0]?.path) },
    user: undefined,
  };
}

async function hasDeliveredPurchase(userId: string, productId: string) {
  const [row] = await prisma.$queryRaw<Array<{ found: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM "orders" o, jsonb_array_elements(o."items") item
      WHERE o."user_id" = ${userId}::uuid AND o."status" = 'Delivered' AND item->>'productId' = ${productId}
    ) AS found
  `;
  return Boolean(row?.found);
}

export async function listPublicReviews(productId: string) {
  await ensureReviewTable();
  const reviews = await prisma.review.findMany({ where: { productId, status: ReviewStatus.APPROVED, isSpam: false }, include, orderBy: { createdAt: "desc" } });
  return reviews.map(normalizeReview);
}

export async function listLatestPublicReviews() {
  await ensureReviewTable();
  const reviews = await prisma.review.findMany({
    where: { status: ReviewStatus.APPROVED, isSpam: false },
    include,
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return reviews.map(normalizeReview);
}

export async function createReview(userId: string, productId: string, input: { rating: number; title: string; text: string }, files: Express.Multer.File[]) {
  await ensureReviewTable();
  const settings = await getReviewSettings();
  const maxBytes = settings.maxImageSizeMb * 1024 * 1024;
  if (files.length > settings.maxImages || files.some((file) => file.size > maxBytes)) {
    await Promise.all(files.map((file) => deleteLocalUpload(`/uploads/reviews/${file.filename}`)));
    throw new HttpError(400, `Upload up to ${settings.maxImages} images, maximum ${settings.maxImageSizeMb} MB each.`);
  }
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) throw new HttpError(404, "Product not found.");
  const existing = await prisma.review.findUnique({ where: { userId_productId: { userId, productId } } });
  if (existing) throw new HttpError(409, "You have already reviewed this product.");
  const review = await prisma.review.create({
    data: {
      userId, productId, rating: input.rating, title: input.title, text: input.text,
      images: files.map((file) => `/uploads/reviews/${file.filename}`),
      verifiedPurchase: await hasDeliveredPurchase(userId, productId),
      status: settings.manualApprovalRequired ? ReviewStatus.PENDING : ReviewStatus.APPROVED,
    },
    include,
  });
  return normalizeReview(review);
}

export async function listAdminReviews(search?: string, status?: ReviewStatus) {
  await ensureReviewTable();
  const searchWhere = search
    ? { OR: [{ title: { contains: search, mode: "insensitive" as const } }, { text: { contains: search, mode: "insensitive" as const } }, { user: { email: { contains: search, mode: "insensitive" as const } } }, { product: { name: { contains: search, mode: "insensitive" as const } } }] }
    : {};
  const [reviews, total, pending, approved, verified, spam] = await prisma.$transaction([
    prisma.review.findMany({ where: { ...searchWhere, ...(status ? { status } : {}) }, include, orderBy: { createdAt: "desc" } }),
    prisma.review.count(),
    prisma.review.count({ where: { status: ReviewStatus.PENDING } }),
    prisma.review.count({ where: { status: ReviewStatus.APPROVED } }),
    prisma.review.count({ where: { verifiedPurchase: true } }),
    prisma.review.count({ where: { isSpam: true } }),
  ]);
  return {
    items: reviews.map(normalizeReview),
    overview: { total, pending, approved, verified, spam },
  };
}

export async function updateReview(reviewId: string, input: { status?: ReviewStatus; adminReply?: string | null; isSpam?: boolean }) {
  await ensureReviewTable();
  const review = await prisma.review.update({ where: { id: reviewId }, data: input, include });
  return normalizeReview(review);
}

export async function deleteReview(reviewId: string) {
  await ensureReviewTable();
  const review = await prisma.review.delete({ where: { id: reviewId } });
  await Promise.all(review.images.map(deleteLocalUpload));
}
