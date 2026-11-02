-- M4.10.1.1: mail owed for an order event. Additive only: no existing table or row changes.

CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED');

CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL,
    "event" VARCHAR(64) NOT NULL,
    "orderId" UUID NOT NULL,
    "recipient" VARCHAR(254) NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "notification_deliveries_event_orderId_recipient_key" ON "notification_deliveries"("event","orderId","recipient");
CREATE INDEX "notification_deliveries_status_createdAt_idx" ON "notification_deliveries"("status","createdAt");
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
