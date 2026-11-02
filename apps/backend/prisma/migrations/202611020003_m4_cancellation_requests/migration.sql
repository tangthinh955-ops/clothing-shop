-- M4.4.4: a customer asking to cancel while the order is being packed. Additive only: no existing table or row changes.

CREATE TYPE "CancellationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "cancellation_requests" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "status" "CancellationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cancellation_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "cancellation_requests_orderId_status_idx" ON "cancellation_requests"("orderId","status");
CREATE INDEX "cancellation_requests_status_createdAt_idx" ON "cancellation_requests"("status","createdAt");
ALTER TABLE "cancellation_requests" ADD CONSTRAINT "cancellation_requests_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
