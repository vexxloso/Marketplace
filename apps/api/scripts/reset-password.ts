import * as bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const apiEnvPath = path.resolve(scriptDir, "..", ".env");
const rootEnvPath = path.resolve(scriptDir, "..", "..", "..", ".env");

config({ path: rootEnvPath });
config({ path: apiEnvPath, override: true });

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const newPassword = process.env.NEW_PASSWORD;

  if (!email) {
    throw new Error(
      "Set ADMIN_EMAIL to the account email (same as promote-admin), e.g. ADMIN_EMAIL=you@example.com",
    );
  }
  if (!newPassword || newPassword.length < 8) {
    throw new Error("Set NEW_PASSWORD to at least 8 characters.");
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true },
  });

  if (!existing) {
    throw new Error(`No user found for ${email}`);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: existing.id },
    data: { passwordHash },
  });

  console.log(`Password updated for ${existing.email} (role: ${existing.role}).`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Failed to reset password");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
