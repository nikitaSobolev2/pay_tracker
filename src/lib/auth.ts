import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer, username } from "better-auth/plugins";

import { loginTransferPlugin } from "@/lib/auth/login-transfer-plugin";
import { qrApprovalPlugin } from "@/lib/auth/qr-approval-plugin";
import { getDefaultCurrency } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { AppLocale, AppTheme } from "@/types/enums";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
  },
  // Devices page calls listSessions, which uses freshSessionMiddleware.
  // Default freshAge (1 day) blocks listing after the session ages out.
  session: {
    expiresIn: 60 * 60 * 24 * 365, // 1 year
    updateAge: 60 * 60 * 24 * 7, // refresh expiry weekly while active
    freshAge: 0,
  },
  plugins: [
    username(),
    bearer(),
    loginTransferPlugin(),
    qrApprovalPlugin(),
  ],
  user: {
    additionalFields: {
      locale: {
        type: "string",
        required: false,
        defaultValue: AppLocale.En,
        input: false,
      },
      timezone: {
        type: "string",
        required: false,
        defaultValue: "UTC",
        input: false,
      },
      theme: {
        type: "string",
        required: false,
        defaultValue: AppTheme.System,
        input: false,
      },
      defaultCurrency: {
        type: "string",
        required: false,
        defaultValue: getDefaultCurrency(),
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => ({
          data: {
            ...user,
            locale: AppLocale.En,
            timezone: process.env.DEFAULT_TIMEZONE ?? "UTC",
            theme: AppTheme.System,
            defaultCurrency: getDefaultCurrency(),
          },
        }),
      },
    },
  },
});
