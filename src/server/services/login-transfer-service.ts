import { AppServiceError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { ApiErrorCode } from "@/types/api";

import {
  buildLoginTransferAuthUrl,
  generateNumericCode,
  generateTransferToken,
  hashSecret,
  isTransferExpired,
  isValidLoginCode,
  normalizeLoginCode,
  transferExpiresAt,
} from "./login-transfer-crypto";
import type {
  CreateLoginTransferInput,
  CreateLoginTransferResult,
  RedeemLoginTransferInput,
  RedeemLoginTransferResult,
} from "./login-transfer-service.types";

const CODE_COLLISION_ATTEMPTS = 8;

export async function getOrCreateLoginTransfer(
  input: CreateLoginTransferInput,
): Promise<CreateLoginTransferResult> {
  const now = new Date();
  const active = await prisma.loginTransfer.findFirst({
    where: {
      userId: input.userId,
      consumedAt: null,
      expiresAt: { gt: now },
      // Skip pre-plaintext rows that cannot be shown again.
      code: { not: "" },
      token: { not: "" },
    },
    orderBy: { createdAt: "desc" },
    select: {
      code: true,
      token: true,
      expiresAt: true,
    },
  });

  if (active) {
    return toTransferResult(input, active);
  }

  return createLoginTransfer(input);
}

/** Always mints a new code and invalidates any prior active unused codes. */
export async function createLoginTransfer(
  input: CreateLoginTransferInput,
): Promise<CreateLoginTransferResult> {
  const now = new Date();
  const expiresAt = transferExpiresAt(now);
  const token = generateTransferToken();
  const tokenHash = hashSecret(token);

  let code = "";
  let codeHash = "";
  for (let attempt = 0; attempt < CODE_COLLISION_ATTEMPTS; attempt += 1) {
    code = generateNumericCode();
    codeHash = hashSecret(code);
    const clash = await prisma.loginTransfer.findFirst({
      where: {
        codeHash,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      select: { id: true },
    });
    if (!clash) {
      break;
    }
    if (attempt === CODE_COLLISION_ATTEMPTS - 1) {
      throw new AppServiceError(
        ApiErrorCode.Internal,
        "Unable to allocate a login code",
      );
    }
  }

  await prisma.$transaction([
    prisma.loginTransfer.updateMany({
      where: {
        userId: input.userId,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { expiresAt: now },
    }),
    prisma.loginTransfer.create({
      data: {
        userId: input.userId,
        code,
        token,
        codeHash,
        tokenHash,
        expiresAt,
      },
    }),
  ]);

  return toTransferResult(input, { code, token, expiresAt });
}

export async function redeemLoginTransfer(
  input: RedeemLoginTransferInput,
): Promise<RedeemLoginTransferResult> {
  const now = new Date();
  const transfer = await findRedeemableTransfer(input, now);
  if (!transfer) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Invalid or expired login code",
    );
  }

  const updated = await prisma.loginTransfer.updateMany({
    where: {
      id: transfer.id,
      consumedAt: null,
      expiresAt: { gt: now },
    },
    data: { consumedAt: now },
  });

  if (updated.count === 0) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Invalid or expired login code",
    );
  }

  return { userId: transfer.userId };
}

function toTransferResult(
  input: CreateLoginTransferInput,
  transfer: { code: string; token: string; expiresAt: Date },
): CreateLoginTransferResult {
  return {
    code: transfer.code,
    token: transfer.token,
    authUrl: buildLoginTransferAuthUrl({
      baseUrl: input.baseUrl,
      locale: input.locale,
      token: transfer.token,
    }),
    expiresAt: transfer.expiresAt.toISOString(),
  };
}

async function findRedeemableTransfer(
  input: RedeemLoginTransferInput,
  now: Date,
) {
  if (input.token) {
    const transfer = await prisma.loginTransfer.findUnique({
      where: { tokenHash: hashSecret(input.token) },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        consumedAt: true,
      },
    });
    return isRedeemable(transfer, now) ? transfer : null;
  }

  if (!input.code) {
    return null;
  }

  const code = normalizeLoginCode(input.code);
  if (!isValidLoginCode(code)) {
    return null;
  }

  const transfer = await prisma.loginTransfer.findFirst({
    where: {
      codeHash: hashSecret(code),
      consumedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      consumedAt: true,
    },
  });

  return isRedeemable(transfer, now) ? transfer : null;
}

function isRedeemable(
  transfer: {
    expiresAt: Date;
    consumedAt: Date | null;
  } | null,
  now: Date,
): transfer is {
  id: string;
  userId: string;
  expiresAt: Date;
  consumedAt: Date | null;
} {
  if (!transfer) {
    return false;
  }
  if (transfer.consumedAt) {
    return false;
  }
  if (isTransferExpired(transfer.expiresAt, now)) {
    return false;
  }
  return true;
}
