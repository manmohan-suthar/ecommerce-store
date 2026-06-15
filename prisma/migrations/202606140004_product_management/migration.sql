CREATE TYPE "ProductType" AS ENUM ('SIMPLE', 'VARIABLE');
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "StockStatus" AS ENUM ('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'BACKORDER');
CREATE TYPE "ProductMediaType" AS ENUM ('IMAGE', 'VIDEO');

ALTER TABLE "products" ADD COLUMN "sku" TEXT, ADD COLUMN "type" "ProductType" NOT NULL DEFAULT 'SIMPLE',
ADD COLUMN "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT', ADD COLUMN "short_description" TEXT,
ADD COLUMN "description" TEXT, ADD COLUMN "brand_id" UUID, ADD COLUMN "gender" TEXT,
ADD COLUMN "is_featured" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "is_new_arrival" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "regular_price" DECIMAL(12,2), ADD COLUMN "sale_price" DECIMAL(12,2), ADD COLUMN "sale_starts_at" TIMESTAMP(3),
ADD COLUMN "sale_ends_at" TIMESTAMP(3), ADD COLUMN "cost_price" DECIMAL(12,2), ADD COLUMN "is_taxable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "tax_class" TEXT, ADD COLUMN "stock_quantity" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "low_stock_threshold" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN "stock_status" "StockStatus" NOT NULL DEFAULT 'IN_STOCK', ADD COLUMN "allow_backorder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "max_order_quantity" INTEGER, ADD COLUMN "weight" DECIMAL(10,3), ADD COLUMN "length" DECIMAL(10,2),
ADD COLUMN "width" DECIMAL(10,2), ADD COLUMN "height" DECIMAL(10,2), ADD COLUMN "shipping_class" TEXT,
ADD COLUMN "is_free_shipping" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "is_cod_eligible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "dispatch_days" INTEGER, ADD COLUMN "use_global_policies" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN "shipping_policy" TEXT,
ADD COLUMN "return_policy" TEXT, ADD COLUMN "exchange_policy" TEXT, ADD COLUMN "warranty_details" TEXT,
ADD COLUMN "is_return_allowed" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN "return_window_days" INTEGER,
ADD COLUMN "seo_title" TEXT, ADD COLUMN "meta_description" TEXT, ADD COLUMN "search_keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "canonical_url" TEXT;

CREATE TABLE "brands" ("id" UUID NOT NULL, "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "is_active" BOOLEAN NOT NULL DEFAULT true, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "brands_pkey" PRIMARY KEY ("id"));
CREATE TABLE "tags" ("id" UUID NOT NULL, "name" TEXT NOT NULL, "slug" TEXT NOT NULL, CONSTRAINT "tags_pkey" PRIMARY KEY ("id"));
CREATE TABLE "product_tags" ("product_id" UUID NOT NULL, "tag_id" UUID NOT NULL, CONSTRAINT "product_tags_pkey" PRIMARY KEY ("product_id","tag_id"));
CREATE TABLE "product_media" ("id" UUID NOT NULL, "product_id" UUID NOT NULL, "type" "ProductMediaType" NOT NULL DEFAULT 'IMAGE', "path" TEXT NOT NULL, "alt_text" TEXT, "display_order" INTEGER NOT NULL DEFAULT 0, "is_primary" BOOLEAN NOT NULL DEFAULT false, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "product_media_pkey" PRIMARY KEY ("id"));
CREATE TABLE "product_variations" ("id" UUID NOT NULL, "product_id" UUID NOT NULL, "sku" TEXT NOT NULL, "regular_price" DECIMAL(12,2) NOT NULL, "sale_price" DECIMAL(12,2), "stock_quantity" INTEGER NOT NULL DEFAULT 0, "low_stock_threshold" INTEGER NOT NULL DEFAULT 5, "stock_status" "StockStatus" NOT NULL DEFAULT 'IN_STOCK', "weight" DECIMAL(10,3), "length" DECIMAL(10,2), "width" DECIMAL(10,2), "height" DECIMAL(10,2), "image_path" TEXT, "is_active" BOOLEAN NOT NULL DEFAULT true, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "product_variations_pkey" PRIMARY KEY ("id"));
CREATE TABLE "product_variation_selections" ("variation_id" UUID NOT NULL, "attribute_value_id" UUID NOT NULL, CONSTRAINT "product_variation_selections_pkey" PRIMARY KEY ("variation_id","attribute_value_id"));

CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku"); CREATE INDEX "products_status_idx" ON "products"("status"); CREATE INDEX "products_type_idx" ON "products"("type"); CREATE INDEX "products_brand_id_idx" ON "products"("brand_id");
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug"); CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");
CREATE INDEX "product_media_product_id_display_order_idx" ON "product_media"("product_id","display_order");
CREATE UNIQUE INDEX "product_variations_sku_key" ON "product_variations"("sku"); CREATE INDEX "product_variations_product_id_idx" ON "product_variations"("product_id"); CREATE INDEX "product_variation_selections_attribute_value_id_idx" ON "product_variation_selections"("attribute_value_id");

ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_variations" ADD CONSTRAINT "product_variations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_variation_selections" ADD CONSTRAINT "product_variation_selections_variation_id_fkey" FOREIGN KEY ("variation_id") REFERENCES "product_variations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_variation_selections" ADD CONSTRAINT "product_variation_selections_attribute_value_id_fkey" FOREIGN KEY ("attribute_value_id") REFERENCES "attribute_values"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
