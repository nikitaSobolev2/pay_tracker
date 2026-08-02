/**
 * Seeds a public event with people + a messy shopping list for AI analyze testing.
 *
 * Usage:
 *   npx tsx scripts/seed-event-ai-fixture.ts
 *   npx tsx scripts/seed-event-ai-fixture.ts --email=you@example.com
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Missing required environment variable: DATABASE_URL");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const PEOPLE = [
  { name: "Egor", status: "CERTAIN" as const },
  { name: "Vova", status: "UNCERTAIN" as const },
  { name: "Masha", status: "CERTAIN" as const },
  { name: "Dasha", status: "CERTAIN" as const },
  { name: "Ivan", status: "UNCERTAIN" as const },
];

/** Mix of realistic rows and deliberate amount/price mistakes for the analyzer. */
const SPENDINGS = [
  {
    title: "Watermelon",
    category: "FOOD" as const,
    amount: "2",
    amountUnit: "шт",
    price: "350",
    note: "Normal — should look fine",
  },
  {
    title: "Bread",
    category: "FOOD" as const,
    amount: "4",
    amountUnit: "шт",
    price: "60",
    note: null,
  },
  {
    title: "Cheese",
    category: "FOOD" as const,
    amount: "0.8",
    amountUnit: "кг",
    price: "900",
    note: null,
  },
  {
    title: "Salt",
    category: "FOOD" as const,
    amount: "50",
    amountUnit: "кг",
    price: "40",
    note: "Way too much salt for ~5 people",
  },
  {
    title: "Still water",
    category: "DRINKS" as const,
    amount: "200",
    amountUnit: "л",
    price: "45",
    note: "Absurd volume for a short gathering",
  },
  {
    title: "Cola",
    category: "DRINKS" as const,
    amount: "6",
    amountUnit: "л",
    price: "120",
    note: null,
  },
  {
    title: "Beer",
    category: "ALCOHOL" as const,
    amount: "12",
    amountUnit: "л",
    price: "180",
    note: null,
  },
  {
    title: "Vodka",
    category: "ALCOHOL" as const,
    amount: "1",
    amountUnit: "шт",
    price: "50000",
    note: "Unit price is nonsense",
  },
  {
    title: "Disposable cups",
    category: "OTHER" as const,
    amount: "10",
    amountUnit: "шт",
    price: "5",
    note: "Too few cups vs attendees",
  },
  {
    title: "Cottage rental",
    category: "HOUSING" as const,
    amount: "1",
    amountUnit: "шт",
    price: "12000",
    note: "Overnight stay — roughly fine",
  },
];

async function main() {
  const email = readEmailArg();
  const user = email
    ? await prisma.user.findUnique({ where: { email } })
    : await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });

  if (!user) {
    throw new Error(
      email
        ? `No user with email ${email}`
        : "No users in the database — sign up once, then re-run.",
    );
  }

  const starts = nextSaturdayEvening();
  const ends = new Date(starts.getTime() + 18 * 60 * 60 * 1000);

  const event = await prisma.event.create({
    data: {
      userId: user.id,
      title: "AI fixture: dacha weekend",
      description: [
        "## Test event for AI analyze",
        "",
        "Shopping list intentionally includes bad quantities/prices",
        "(50 kg salt, 200 L water, vodka at 50 000 ₽, only 10 cups).",
        "",
        "Open **Analyze** on the event page to try the AI report.",
      ].join("\n"),
      occursAt: starts,
      endsAt: ends,
      address:
        "Terem Palace, Cathedral Square, 19, Tverskoy District, Moscow, Russia",
      latitude: 55.752023,
      longitude: 37.617499,
      publicity: "PUBLIC",
      guestPermission: "EDIT",
      currency: user.defaultCurrency.toUpperCase(),
      ownerDisplayName: user.name,
      attendees: {
        create: await Promise.all(
          PEOPLE.map(async (person) => {
            const counterparty = await prisma.userCounterparty.upsert({
              where: {
                userId_name: { userId: user.id, name: person.name },
              },
              create: { userId: user.id, name: person.name },
              update: {},
            });
            return {
              counterpartyId: counterparty.id,
              status: person.status,
            };
          }),
        ),
      },
      spendings: {
        create: SPENDINGS.map((item) => ({
          title: item.title,
          category: item.category,
          amount: item.amount,
          amountUnit: item.amountUnit,
          price: item.price,
          note: item.note,
          authorUserId: user.id,
        })),
      },
      links: {
        create: [
          {
            type: "LOCATION",
            title: "Maps",
            url: "https://www.openstreetmap.org/?mlat=55.752023&mlon=37.617499#map=17/55.752023/37.617499",
          },
        ],
      },
    },
    include: {
      attendees: true,
    },
  });

  // Partial payments so settlement / people panel look alive.
  const attendees = await prisma.eventAttendee.findMany({
    where: { eventId: event.id },
    include: { counterparty: { select: { name: true } } },
  });
  const egorAttendee = attendees.find((row) => row.counterparty.name === "Egor");
  const mashaAttendee = attendees.find(
    (row) => row.counterparty.name === "Masha",
  );

  if (egorAttendee) {
    await prisma.eventPayment.create({
      data: {
        eventId: event.id,
        attendeeId: egorAttendee.id,
        amount: "5000",
      },
    });
  }
  if (mashaAttendee) {
    await prisma.eventPayment.create({
      data: {
        eventId: event.id,
        attendeeId: mashaAttendee.id,
        amount: "2500",
      },
    });
  }

  const locale = user.locale?.startsWith("ru") ? "ru" : "en";
  const path = `/${locale}/event/${event.id}`;

  console.log("Seeded AI fixture event");
  console.log(`  owner:  ${user.email} (${user.name})`);
  console.log(`  event:  ${event.title}`);
  console.log(`  id:     ${event.id}`);
  console.log(`  people: ${PEOPLE.length}`);
  console.log(`  items:  ${SPENDINGS.length}`);
  console.log(`  open:   http://localhost:3000${path}`);
}

function readEmailArg(): string | undefined {
  const flag = process.argv.find((arg) => arg.startsWith("--email="));
  return flag?.slice("--email=".length)?.trim() || undefined;
}

/** Next Saturday 18:00 local-ish (UTC+3 approximation for Moscow fixtures). */
function nextSaturdayEvening(): Date {
  const now = new Date();
  const day = now.getUTCDay();
  const daysUntilSaturday = (6 - day + 7) % 7 || 7;
  const date = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + daysUntilSaturday,
      15,
      0,
      0,
    ),
  );
  return date;
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
