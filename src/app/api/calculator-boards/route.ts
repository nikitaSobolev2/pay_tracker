import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import {
  createCalculatorBoard,
  listCalculatorBoards,
} from "@/server/services/calculator-board-service";

const createBodySchema = z.object({
  title: z.string().min(1).max(200),
  query: z.unknown(),
  session: z.unknown(),
});

export async function GET() {
  try {
    const user = await requireUser();
    const boards = await listCalculatorBoards(user.id);
    return jsonOk({ boards });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = createBodySchema.parse(await request.json());
    const board = await createCalculatorBoard({
      userId: user.id,
      title: body.title,
      query: body.query,
      session: body.session,
    });
    return jsonOk({ board }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
