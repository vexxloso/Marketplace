import bcrypt from "bcryptjs";
import { Prisma, PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const apiEnvPath = path.resolve(scriptDir, "..", ".env");
const rootEnvPath = path.resolve(scriptDir, "..", "..", "..", ".env");

config({ path: rootEnvPath });
config({ path: apiEnvPath, override: true });

const prisma = new PrismaClient();

const d = (n: number) => new Prisma.Decimal(n);

async function main() {
  const marker =
    process.env.SEED_MARKER_EMAIL?.trim().toLowerCase() ?? "demo-host@market.local";
  const passwordPlain =
    process.env.SEED_DEMO_PASSWORD ?? "DemoHost-ChangeMe-12";

  const existingHost = await prisma.user.findUnique({
    where: { email: marker },
    select: { id: true, email: true },
  });

  const passwordHash = await bcrypt.hash(passwordPlain, 10);

  const host =
    existingHost ??
    (await prisma.user.create({
      data: {
        email: marker,
        name: "Demo Host",
        passwordHash,
        role: "USER",
        isVerified: true,
      },
      select: { id: true, email: true },
    }));

  if (!existingHost) {
    console.log(`Created demo host: ${host.email} (password from SEED_DEMO_PASSWORD or default — change after login).`);
  }

  const publishedCount = await prisma.listing.count({
    where: { hostId: host.id, status: "PUBLISHED" },
  });

  if (publishedCount > 0) {
    console.log(`Skip: ${host.email} already has ${publishedCount} published listing(s).`);
    return;
  }

  const samples: Prisma.ListingCreateManyInput[] = [
    {
      hostId: host.id,
      title: "The Gothic Room at Chateau Trebesice",
      description:
        "A dramatic stone chamber with vineyard views, curated antiques, and quiet luxury. Ideal for a slow weekend away from city noise.",
      city: "Trebesice",
      country: "Czech Republic",
      latitude: new Prisma.Decimal("48.85"),
      longitude: new Prisma.Decimal("16.35"),
      pricePerDay: d(198),
      weekendPrice: d(225),
      cleaningFee: d(40),
      minimumStayNights: 2,
      status: "PUBLISHED",
    },
    {
      hostId: host.id,
      title: "MIKO II · Micro Cabin for Two",
      description:
        "Compact Nordic cabin with floor-to-ceiling glass, wood stove, and a private deck framed by pine. Built for two, designed for calm.",
      city: "North Pine",
      country: "Canada",
      latitude: new Prisma.Decimal("44.231"),
      longitude: new Prisma.Decimal("-78.455"),
      pricePerDay: d(120),
      minimumStayNights: 2,
      status: "PUBLISHED",
    },
    {
      hostId: host.id,
      title: "Carrickreagh Houseboat",
      description:
        "Gently moored houseboat with sunrise decks, galley kitchen, and rowing skiff. Waterside living without sacrificing comfort.",
      addressLine: "Lough Erne mooring",
      city: "Enniskillen",
      country: "United Kingdom",
      latitude: new Prisma.Decimal("54.343"),
      longitude: new Prisma.Decimal("-7.631"),
      pricePerDay: d(254),
      cleaningFee: d(55),
      minimumStayNights: 3,
      status: "PUBLISHED",
    },
    {
      hostId: host.id,
      title: "Private Pool Villa Retreat",
      description:
        "Courtyard villa with heated plunge pool, outdoor shower, and concierge-ready kitchen. Designed for unhurried mornings.",
      city: "Toulon",
      country: "France",
      latitude: new Prisma.Decimal("43.124"),
      longitude: new Prisma.Decimal("5.928"),
      pricePerDay: d(320),
      weekendPrice: d(360),
      minimumStayNights: 4,
      status: "PUBLISHED",
    },
    {
      hostId: host.id,
      title: "Room in Toulon · Harbour light",
      description:
        "Top-floor room overlooking the old harbour — walkable to markets, boats, and late-night bistros.",
      city: "Toulon",
      country: "France",
      latitude: new Prisma.Decimal("43.117"),
      longitude: new Prisma.Decimal("5.935"),
      pricePerDay: d(50),
      minimumStayNights: 1,
      lastMinuteDiscountPercent: 10,
      status: "PUBLISHED",
    },
  ];

  await prisma.listing.createMany({ data: samples });
  console.log(`Inserted ${samples.length} published listings for ${host.email}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
