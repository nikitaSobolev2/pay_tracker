import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, username: true },
  });
  const events = await prisma.event.findMany({
    select: { id: true, title: true, userId: true },
  });
  const sessions = await prisma.session.findMany({
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: { userId: true, expiresAt: true, updatedAt: true },
  });
  console.log(JSON.stringify({ users, events, sessions }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
