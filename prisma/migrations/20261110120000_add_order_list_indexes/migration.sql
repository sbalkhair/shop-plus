-- Indexes for the paginated admin and delivery order lists.
-- The delivery partner scope, status filter, and createdAt sort are always used
-- together by the driver list, while admins primarily scan by status/date.
CREATE INDEX "Order_deliveryPartnerId_status_createdAt_idx" ON "Order"("deliveryPartnerId", "status", "createdAt");
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");
