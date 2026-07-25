import { jsonOk, internalError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return jsonOk({
      ok: true,
      service: "pay_tracker",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return internalError("Database unavailable");
  }
}
