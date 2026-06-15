CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'ADMIN');
CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE', 'LOCAL');

CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "avatar_url" TEXT,
  "google_id" TEXT,
  "password_hash" TEXT,
  "provider" "AuthProvider" NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");
