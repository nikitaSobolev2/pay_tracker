import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { zodEnumFromConst } from "@/lib/zod-helpers";
import { updatePreferences } from "@/server/services/user-settings-service";
import { AppLocale, AppTheme } from "@/types/enums";

const preferencesSchema = z
  .object({
    locale: zodEnumFromConst(AppLocale).optional(),
    timezone: z.string().min(1).optional(),
    theme: zodEnumFromConst(AppTheme).optional(),
    defaultCurrency: z.string().min(3).max(3).optional(),
  })
  .refine(
    (value) =>
      value.locale !== undefined ||
      value.timezone !== undefined ||
      value.theme !== undefined ||
      value.defaultCurrency !== undefined,
    { message: "At least one preference field is required" },
  );

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = preferencesSchema.parse(await request.json());
    const updated = await updatePreferences({
      userId: user.id,
      ...body,
    });
    return jsonOk({ user: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}
