-- Replace GUEST/HOST/ADMIN with USER/ADMIN (GUEST+HOST -> USER).

CREATE TYPE "UserRole_new" AS ENUM ('USER', 'ADMIN');

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "UserRole_new"
  USING (
    CASE
      WHEN "role"::text = 'ADMIN' THEN 'ADMIN'::"UserRole_new"
      ELSE 'USER'::"UserRole_new"
    END
  );

ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER'::"UserRole_new";

DROP TYPE "UserRole";

ALTER TYPE "UserRole_new" RENAME TO "UserRole";
