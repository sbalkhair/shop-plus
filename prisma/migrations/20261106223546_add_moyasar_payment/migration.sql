-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paidAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "activeOrderId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'moyasar',
    "moyasarIntentId" TEXT,
    "moyasarPaymentId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "status" TEXT NOT NULL DEFAULT 'creating',
    "providerStatus" TEXT,
    "method" TEXT,
    "network" TEXT,
    "lastFour" TEXT,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "metadata" JSONB,
    "intentExpiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_activeOrderId_key" ON "payment"("activeOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_moyasarIntentId_key" ON "payment"("moyasarIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_moyasarPaymentId_key" ON "payment"("moyasarPaymentId");

-- CreateIndex
CREATE INDEX "payment_orderId_idx" ON "payment"("orderId");

-- CreateIndex
CREATE INDEX "payment_status_idx" ON "payment"("status");

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
