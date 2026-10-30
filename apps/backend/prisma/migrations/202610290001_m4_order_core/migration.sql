-- M4.0.2: order foundation — settings, quotes, orders, items, history, idempotency
-- and guest/system actor metadata on inventory_movements (docs/m4-contract.md).
-- Keeps every M3 row; inventory_movements.actorType/source default to ADMIN/ADMIN_ADJUSTMENT.

CREATE TYPE "ActorType" AS ENUM ('ADMIN', 'GUEST', 'SYSTEM');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PACKING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'DELIVERY_FAILED', 'RETURNED_TO_SHOP');
CREATE TYPE "OrderMethod" AS ENUM ('COD', 'BANK_TRANSFER');
CREATE TYPE "OrderSource" AS ENUM ('WEB', 'INSTAGRAM');
CREATE TYPE "InventoryEffectSource" AS ENUM ('ADMIN_ADJUSTMENT', 'ORDER_RESERVE', 'ORDER_RELEASE', 'ORDER_SHIP');

-- ShopSettings: single row, safe built-in defaults, no default bank account.
CREATE TABLE "shop_settings" (
    "id" VARCHAR(16) NOT NULL DEFAULT 'default',
    "shippingFeeVnd" INTEGER NOT NULL DEFAULT 30000,
    "bankDeadlineMinutes" INTEGER NOT NULL DEFAULT 120,
    "bankName" VARCHAR(120),
    "bankBin" VARCHAR(20),
    "bankAccountNumber" VARCHAR(32),
    "bankAccountName" VARCHAR(120),
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shop_settings_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "shop_settings" ADD CONSTRAINT "shop_settings_bounds_valid" CHECK ("shippingFeeVnd" BETWEEN 0 AND 100000000 AND "bankDeadlineMinutes" BETWEEN 15 AND 2880 AND "version" >= 0);

-- CheckoutQuote: server-priced cart draft; never holds stock.
CREATE TABLE "checkout_quotes" (
    "id" UUID NOT NULL,
    "items" JSONB NOT NULL,
    "method" "OrderMethod" NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'VND',
    "subtotalVnd" DECIMAL(14,0) NOT NULL,
    "shippingFeeVnd" DECIMAL(14,0) NOT NULL,
    "totalVnd" DECIMAL(14,0) NOT NULL,
    "settingsVersion" INTEGER NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "checkout_quotes_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "checkout_quotes" ADD CONSTRAINT "checkout_quote_totals_valid" CHECK ("subtotalVnd" >= 0 AND "shippingFeeVnd" BETWEEN 0 AND 100000000 AND "totalVnd" = "subtotalVnd" + "shippingFeeVnd" AND "totalVnd" <= 1000000000);
CREATE INDEX "checkout_quotes_expiresAt_idx" ON "checkout_quotes"("expiresAt");

-- Orders: guest or admin-owned; snapshots items, money, recipient, method and deadline.
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "code" VARCHAR(24) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "source" "OrderSource" NOT NULL DEFAULT 'WEB',
    "userId" UUID,
    "quoteId" UUID,
    "recipientName" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(254),
    "province" VARCHAR(100) NOT NULL,
    "district" VARCHAR(100) NOT NULL,
    "ward" VARCHAR(100) NOT NULL,
    "addressLine" VARCHAR(255) NOT NULL,
    "note" VARCHAR(500),
    "method" "OrderMethod" NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'VND',
    "subtotalVnd" DECIMAL(14,0) NOT NULL,
    "shippingFeeVnd" DECIMAL(14,0) NOT NULL,
    "totalVnd" DECIMAL(14,0) NOT NULL,
    "settingsVersion" INTEGER NOT NULL,
    "bankDeadlineAt" TIMESTAMPTZ(6),
    "lookupTokenHash" VARCHAR(64),
    "trackingNumber" VARCHAR(100),
    "deliveredAt" TIMESTAMPTZ(6),
    "cancelledAt" TIMESTAMPTZ(6),
    "cancelReason" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "orders" ADD CONSTRAINT "orders_money_valid" CHECK ("subtotalVnd" >= 0 AND "shippingFeeVnd" BETWEEN 0 AND 100000000 AND "totalVnd" = "subtotalVnd" + "shippingFeeVnd" AND "totalVnd" <= 1000000000 AND "version" >= 0);
CREATE UNIQUE INDEX "orders_code_key" ON "orders"("code");
CREATE UNIQUE INDEX "orders_lookupTokenHash_key" ON "orders"("lookupTokenHash");
CREATE INDEX "orders_status_createdAt_idx" ON "orders"("status","createdAt");
CREATE INDEX "orders_phone_idx" ON "orders"("phone");

CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "productName" VARCHAR(120) NOT NULL,
    "sku" VARCHAR(64) NOT NULL,
    "size" VARCHAR(16) NOT NULL,
    "color" VARCHAR(40) NOT NULL,
    "unitPriceVnd" DECIMAL(14,0) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lineTotalVnd" DECIMAL(14,0) NOT NULL,
    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "order_items" ADD CONSTRAINT "order_item_fields_valid" CHECK ("quantity" BETWEEN 1 AND 99 AND "unitPriceVnd" BETWEEN 1 AND 100000000 AND "lineTotalVnd" = "unitPriceVnd" * "quantity");
CREATE UNIQUE INDEX "order_items_orderId_variantId_key" ON "order_items"("orderId","variantId");

CREATE TABLE "order_status_history" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorId" UUID,
    "reason" VARCHAR(500),
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "order_status_history_orderId_createdAt_idx" ON "order_status_history"("orderId","createdAt");

CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "scope" VARCHAR(60) NOT NULL,
    "identity" VARCHAR(120) NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "resourceId" VARCHAR(64),
    "response" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "idempotency_records_scope_identity_key_key" ON "idempotency_records"("scope","identity","key");
CREATE INDEX "idempotency_records_expiresAt_idx" ON "idempotency_records"("expiresAt");

-- Guest/system actor metadata for order inventory effects (m4-contract §6, §9).
ALTER TABLE "inventory_movements" ALTER COLUMN "actorId" DROP NOT NULL;
ALTER TABLE "inventory_movements" ADD COLUMN "actorType" "ActorType" NOT NULL DEFAULT 'ADMIN';
ALTER TABLE "inventory_movements" ADD COLUMN "source" "InventoryEffectSource" NOT NULL DEFAULT 'ADMIN_ADJUSTMENT';
ALTER TABLE "inventory_movements" ADD COLUMN "effectKey" VARCHAR(160);
CREATE UNIQUE INDEX "inventory_movements_effectKey_key" ON "inventory_movements"("effectKey");
-- Reserve/release keep onHand unchanged, so the delta<>0 requirement no longer holds for order effects.
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_effect_valid";
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_effect_valid" CHECK ("after" - "before" = "delta" AND "before" >= 0 AND "after" >= "reserved" AND "reserved" >= 0 AND "version" > 0);

ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "checkout_quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
