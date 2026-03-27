-- CreateEnum
CREATE TYPE "CancellationPolicy" AS ENUM ('FLEXIBLE', 'MODERATE', 'STRICT');

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "cancellationPolicy" "CancellationPolicy" NOT NULL DEFAULT 'MODERATE',
ADD COLUMN     "cleaningFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "instantBook" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastMinuteDiscountPercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "minimumStayNights" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "weekendPrice" DECIMAL(10,2),
ADD COLUMN     "weeklyDiscountPercent" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ListingSeasonalRate" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "pricePerDay" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingSeasonalRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListingSeasonalRate_listingId_idx" ON "ListingSeasonalRate"("listingId");

-- CreateIndex
CREATE INDEX "ListingSeasonalRate_startDate_endDate_idx" ON "ListingSeasonalRate"("startDate", "endDate");

-- AddForeignKey
ALTER TABLE "ListingSeasonalRate" ADD CONSTRAINT "ListingSeasonalRate_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
