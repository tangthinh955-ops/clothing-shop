-- M4.10.2.1: when a failed delivery may be tried again. Additive only: existing rows keep NULL.

ALTER TABLE "notification_deliveries" ADD COLUMN "nextAttemptAt" TIMESTAMPTZ(6);
CREATE INDEX "notification_deliveries_status_nextAttemptAt_idx" ON "notification_deliveries"("status","nextAttemptAt");
