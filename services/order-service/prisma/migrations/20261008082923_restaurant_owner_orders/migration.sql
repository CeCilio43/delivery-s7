-- CreateTable
CREATE TABLE "RestaurantProjection" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantProjection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RestaurantProjection_ownerId_idx" ON "RestaurantProjection"("ownerId");

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "confirmedAt" TIMESTAMP(3);

-- Backfill: orders that already got past payment count as confirmed at their
-- last update. Cancelled orders are left alone, since there's no record of
-- whether they were paid before being cancelled.
UPDATE "Order" SET "confirmedAt" = "updatedAt"
WHERE "status" IN ('CONFIRMED', 'PREPARING', 'READY', 'PICKED_UP', 'DELIVERED', 'COMPLETED');
