CREATE TYPE "StockAdjustmentReason" AS ENUM ('NEW_STOCK_RECEIVED', 'DAMAGED_ITEM', 'MANUAL_CORRECTION', 'ORDER_CANCELLATION', 'RETURN_RECEIVED');
CREATE TYPE "StockMovementType" AS ENUM ('INCREASE', 'DECREASE', 'SET');

CREATE TABLE "stock_movements" (
  "id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "variation_id" UUID,
  "movement_type" "StockMovementType" NOT NULL,
  "reason" "StockAdjustmentReason" NOT NULL,
  "sku_snapshot" TEXT NOT NULL,
  "item_name_snapshot" TEXT NOT NULL,
  "previous_quantity" INTEGER NOT NULL,
  "adjustment_quantity" INTEGER NOT NULL,
  "new_quantity" INTEGER NOT NULL,
  "note" TEXT,
  "created_by_email" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stock_movements_product_id_created_at_idx" ON "stock_movements"("product_id", "created_at");
CREATE INDEX "stock_movements_variation_id_created_at_idx" ON "stock_movements"("variation_id", "created_at");
CREATE INDEX "stock_movements_reason_idx" ON "stock_movements"("reason");

ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_variation_id_fkey" FOREIGN KEY ("variation_id") REFERENCES "product_variations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
