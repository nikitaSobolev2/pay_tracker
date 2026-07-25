import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import {
  deleteCategory,
  updateCategory,
} from "@/server/services/category-service";

const updateBodySchema = z
  .object({
    title: z.string().min(1).max(100).optional(),
    parentCategoryId: z.string().min(1).nullable().optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined || value.parentCategoryId !== undefined,
    { message: "At least one field is required" },
  );

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = updateBodySchema.parse(await request.json());
    const category = await updateCategory({
      userId: user.id,
      categoryId: id,
      title: body.title,
      parentCategoryId: body.parentCategoryId,
    });
    return jsonOk({ category });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    await deleteCategory({
      userId: user.id,
      categoryId: id,
    });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
