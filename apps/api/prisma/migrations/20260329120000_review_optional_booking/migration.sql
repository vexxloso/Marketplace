-- Allow reviews without a booking; one review per author per listing.
DROP INDEX IF EXISTS "Review_authorId_bookingId_key";

ALTER TABLE "Review" ALTER COLUMN "bookingId" DROP NOT NULL;

CREATE UNIQUE INDEX "Review_authorId_listingId_key" ON "Review"("authorId", "listingId");
