import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { zodEnumFromConst } from "@/lib/zod-helpers";
import {
  createCategory,
  listCategories,
} from "@/server/services/category-service";
import { TransactionType } from "@/types/enums";

const listQuerySchema = z.object({
  type: zodEnumFromConst(TransactionType).optional(),
});

const createBodySchema = z.object({
  title: z.string().min(1).max(200),
  type: zodEnumFromConst(TransactionType),
  parentCategoryId: z.string().min(1).nullable().optional(),
  keywords: z.array(z.string().min(1).max(100)).max(50).optional(),
});

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const query = listQuerySchema.parse({
      type: searchParams.get("type") ?? undefined,
    });
    const categories = await listCategories({
      userId: user.id,
      type: query.type,
    });
    return jsonOk({ categories });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = createBodySchema.parse(await request.json());
    const category = await createCategory({
      userId: user.id,
      title: body.title,
      type: body.type,
      parentCategoryId: body.parentCategoryId,
      keywords: body.keywords,
    });
    return jsonOk({ category }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
