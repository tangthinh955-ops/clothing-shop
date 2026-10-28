-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN');

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "description" VARCHAR(5000) NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "priceFrom" DECIMAL(14,0) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variants" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "sku" VARCHAR(64) NOT NULL,
    "size" VARCHAR(16) NOT NULL,
    "color" VARCHAR(40) NOT NULL,
    "price" DECIMAL(14,0) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory" (
    "variantId" UUID NOT NULL,
    "onHand" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("variantId")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" VARCHAR(300) NOT NULL,
    "before" INTEGER NOT NULL,
    "after" INTEGER NOT NULL,
    "reserved" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_assets" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "storageKey" VARCHAR(80) NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_status_categoryId_createdAt_idx" ON "products"("status", "categoryId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "variants_sku_key" ON "variants"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "variants_productId_size_color_key" ON "variants"("productId", "size", "color");

-- CreateIndex
CREATE INDEX "inventory_movements_variantId_createdAt_idx" ON "inventory_movements"("variantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_movements_actorId_key_key" ON "inventory_movements"("actorId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "upload_assets_storageKey_key" ON "upload_assets"("storageKey");

-- CreateIndex
CREATE INDEX "upload_assets_createdAt_idx" ON "upload_assets"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "product_images_assetId_key" ON "product_images"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "product_images_productId_position_key" ON "product_images"("productId", "position");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variants" ADD CONSTRAINT "variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_assets" ADD CONSTRAINT "upload_assets_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "upload_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Business invariants also enforced by PostgreSQL, including direct/concurrent writes.
ALTER TABLE "categories" ADD CONSTRAINT "category_version_nonnegative" CHECK ("version" >= 0);
ALTER TABLE "products" ADD CONSTRAINT "product_price_version_valid" CHECK ("priceFrom" BETWEEN 1 AND 100000000 AND "version" >= 0);
ALTER TABLE "variants" ADD CONSTRAINT "variant_fields_valid" CHECK ("price" BETWEEN 1 AND 100000000 AND "sku" ~ '^[A-Z0-9][A-Z0-9_-]*$' AND "size" IN ('XS','S','M','L','XL','XXL','3XL','FREESIZE'));
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_bounds_valid" CHECK (0 <= "reserved" AND "reserved" <= "onHand" AND "onHand" <= 1000000 AND "version" >= 0);
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_effect_valid" CHECK ("delta" <> 0 AND "after" - "before" = "delta" AND "before" >= 0 AND "after" >= "reserved" AND "reserved" >= 0 AND "version" > 0);
ALTER TABLE "upload_assets" ADD CONSTRAINT "upload_dimensions_valid" CHECK ("width" > 0 AND "height" > 0);
ALTER TABLE "product_images" ADD CONSTRAINT "image_position_valid" CHECK ("position" BETWEEN 0 AND 7);
