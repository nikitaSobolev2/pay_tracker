import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import {
  createLoginTransfer,
  getOrCreateLoginTransfer,
} from "@/server/services/login-transfer-service";

const bodySchema = z.object({
  locale: z.string().min(2).max(8).optional(),
});

type TransferContext = {
  userId: string;
  locale: string;
  baseUrl: string;
};

async function resolveTransferContext(
  request: Request,
  localeOverride?: string,
): Promise<TransferContext> {
  const user = await requireUser();
  const baseUrl =
    process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ??
    new URL(request.url).origin;
  return {
    userId: user.id,
    locale: localeOverride ?? user.locale,
    baseUrl,
  };
}

/** Return the active unused code, or create one if none exists. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const locale = searchParams.get("locale") ?? undefined;
    const context = await resolveTransferContext(request, locale);
    const transfer = await getOrCreateLoginTransfer(context);
    return jsonOk(transfer);
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Force-rotate: invalidate the current code and mint a new one. */
export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json().catch(() => ({})));
    const context = await resolveTransferContext(request, body.locale);
    const transfer = await createLoginTransfer(context);
    return jsonOk(transfer);
  } catch (error) {
    return handleRouteError(error);
  }
}
