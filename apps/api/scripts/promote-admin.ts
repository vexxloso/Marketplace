import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.resolve(scriptDir, "..", "..", "..", ".env");

config({ path: rootEnvPath });

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  if (!adminEmail) {
    throw new Error(`Missing ADMIN_EMAIL in root .env (${rootEnvPath})`);
  }

  const existing = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { email: true, id: true, role: true },
  });

  if (!existing) {
    throw new Error(`No user found for ADMIN_EMAIL=${adminEmail}`);
  }

  const updated = await prisma.user.update({
    where: { id: existing.id },
    data: { role: "ADMIN" },
    select: { email: true, role: true },
  });

  console.log(`Promoted ${updated.email} to ${updated.role}`);
}

main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Failed to promote admin user",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
