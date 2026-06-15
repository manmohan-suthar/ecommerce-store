CREATE TABLE "customer_profiles" (
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
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_profiles_user_id_key" ON "customer_profiles"("user_id");

ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
