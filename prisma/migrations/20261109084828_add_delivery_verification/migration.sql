-- AlterTable
ALTER TABLE "DeliveryPartner" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "isDriver" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "delivery_verification" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codeEncrypted" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "verifiedByDeliveryPartnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_verification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_verification_orderId_key" ON "delivery_verification"("orderId");

-- CreateIndex
CREATE INDEX "delivery_verification_expiresAt_idx" ON "delivery_verification"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryPartner_userId_key" ON "DeliveryPartner"("userId");

-- AddForeignKey
ALTER TABLE "DeliveryPartner" ADD CONSTRAINT "DeliveryPartner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_verification" ADD CONSTRAINT "delivery_verification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_verification" ADD CONSTRAINT "delivery_verification_verifiedByDeliveryPartnerId_fkey" FOREIGN KEY ("verifiedByDeliveryPartnerId") REFERENCES "DeliveryPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

