CREATE TABLE "promo_codes" (
  "id" UUID NOT NULL PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "discount_type" TEXT NOT NULL,
  "discount_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "maximum_discount_amount" DECIMAL(12,2),
  "minimum_cart_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "maximum_cart_amount" DECIMAL(12,2),
  "starts_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "total_usage_limit" INTEGER,
  "per_user_usage_limit" INTEGER NOT NULL DEFAULT 1,
  "per_order_usage_limit" INTEGER NOT NULL DEFAULT 1,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "first_order_only" BOOLEAN NOT NULL DEFAULT false,
  "new_customers_only" BOOLEAN NOT NULL DEFAULT false,
  "specific_customer_ids" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "included_category_ids" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "included_product_ids" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "excluded_category_ids" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "excluded_product_ids" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "allow_sale_products" BOOLEAN NOT NULL DEFAULT true,
  "allow_cod" BOOLEAN NOT NULL DEFAULT true,
  "allow_combination" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "promo_usage" (
  "id" UUID NOT NULL PRIMARY KEY,
  "promo_id" UUID NOT NULL REFERENCES "promo_codes"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "order_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "discount_amount" DECIMAL(12,2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "promo_usage_promo_id_idx" ON "promo_usage"("promo_id");
CREATE INDEX "promo_usage_user_id_idx" ON "promo_usage"("user_id");
