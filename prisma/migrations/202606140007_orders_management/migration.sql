CREATE TABLE "orders" (
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
  CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");
CREATE INDEX "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at");
CREATE INDEX "orders_status_idx" ON "orders"("status");

ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
