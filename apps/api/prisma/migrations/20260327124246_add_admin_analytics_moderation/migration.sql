-- CreateEnum
CREATE TYPE "ReviewModerationStatus" AS ENUM ('VISIBLE', 'HIDDEN');

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "moderationNote" TEXT;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "moderationNote" TEXT,
ADD COLUMN     "moderationStatus" "ReviewModerationStatus" NOT NULL DEFAULT 'VISIBLE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isBanned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isSuspended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "id" TEXT NOT NULL,
    "commissionRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 12,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id")
);
