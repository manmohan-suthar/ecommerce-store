CREATE TYPE "AttributeDisplayType" AS ENUM ('SELECT', 'COLOR', 'BUTTON');

CREATE TABLE "attributes" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "display_type" "AttributeDisplayType" NOT NULL DEFAULT 'SELECT',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_visible_on_storefront" BOOLEAN NOT NULL DEFAULT true,
    "is_used_for_variations" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attributes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "attribute_values" (
    "id" UUID NOT NULL,
    "attribute_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color_hex" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attribute_values_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_attributes" (
    "product_id" UUID NOT NULL,
    "attribute_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_attributes_pkey" PRIMARY KEY ("product_id", "attribute_id")
);

CREATE UNIQUE INDEX "attributes_slug_key" ON "attributes"("slug");
CREATE INDEX "attributes_display_order_idx" ON "attributes"("display_order");
CREATE INDEX "attributes_is_active_idx" ON "attributes"("is_active");
CREATE UNIQUE INDEX "attribute_values_attribute_id_slug_key" ON "attribute_values"("attribute_id", "slug");
CREATE INDEX "attribute_values_attribute_id_display_order_idx" ON "attribute_values"("attribute_id", "display_order");
CREATE INDEX "product_attributes_attribute_id_idx" ON "product_attributes"("attribute_id");

ALTER TABLE "attribute_values"
ADD CONSTRAINT "attribute_values_attribute_id_fkey"
FOREIGN KEY ("attribute_id") REFERENCES "attributes"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_attributes"
ADD CONSTRAINT "product_attributes_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_attributes"
ADD CONSTRAINT "product_attributes_attribute_id_fkey"
FOREIGN KEY ("attribute_id") REFERENCES "attributes"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
