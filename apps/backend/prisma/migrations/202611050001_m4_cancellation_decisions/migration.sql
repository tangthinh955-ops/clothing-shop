-- M4.5.8: the shop's refusal is decided on the cancellation request row itself (reason + decider),
-- and every cancellation request owns its own shop notice so a second request is not blocked by the
-- first one's mail row. Additive only: existing rows keep reading, defaults fill what they lack.

ALTER TABLE "cancellation_requests" ADD COLUMN "decisionReason" VARCHAR(500);
ALTER TABLE "cancellation_requests" ADD COLUMN "decidedById" UUID;
ALTER TABLE "cancellation_requests" ADD CONSTRAINT "cancellation_requests_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notification_deliveries" ADD COLUMN "occurrenceKey" VARCHAR(64) NOT NULL DEFAULT 'order';
-- Prisma created the old uniqueness as a plain unique index, so it goes by DROP INDEX, not DROP CONSTRAINT.
DROP INDEX "notification_deliveries_event_orderId_recipient_key";
CREATE UNIQUE INDEX "notification_deliveries_event_orderId_recipient_occurrenceKey_key" ON "notification_deliveries"("event","orderId","recipient","occurrenceKey");
