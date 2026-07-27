import { AuthApprovalStatus } from "@prisma/client";

import { AppServiceError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { buildApprovalUrl, type QrApprovalStatus } from "@/lib/qr-approval";
import { transferExpiresAt } from "@/lib/login-transfer";
import { ApiErrorCode } from "@/types/api";

import { generateTransferToken, hashSecret } from "./login-transfer-crypto";
import type {
  ApprovalInfo,
  ApprovalStatusResult,
  CreateApprovalInput,
  CreateApprovalResult,
  IncomingApproval,
  RedeemApprovalResult,
  ResolveApprovalInput,
} from "./qr-approval-service.types";

export async function createApproval(
  input: CreateApprovalInput,
): Promise<CreateApprovalResult> {
  const token = generateTransferToken();
  const expiresAt = transferExpiresAt();

  await prisma.authApproval.create({
    data: {
      tokenHash: hashSecret(token),
      status: AuthApprovalStatus.PENDING,
      boundUserId: input.boundUserId ?? null,
      requesterUserAgent: input.requesterUserAgent ?? null,
      requesterIp: input.requesterIp ?? null,
      locale: input.locale,
      expiresAt,
    },
  });

  return {
    token,
    approvalUrl: input.baseUrl
      ? buildApprovalUrl({ baseUrl: input.baseUrl, locale: input.locale, token })
      : "",
    status: "pending",
    expiresAt: expiresAt.toISOString(),
  };
}

export async function getApprovalStatus(
  token: string,
): Promise<ApprovalStatusResult> {
  const row = await prisma.authApproval.findUnique({
    where: { tokenHash: hashSecret(token) },
    select: { status: true, expiresAt: true },
  });
  if (!row) {
    throw notFound();
  }
  return { status: toPublicStatus(row) };
}

export async function getApprovalInfo(
  token: string,
  approverUserId: string,
): Promise<ApprovalInfo> {
  const row = await prisma.authApproval.findUnique({
    where: { tokenHash: hashSecret(token) },
    select: {
      status: true,
      expiresAt: true,
      boundUserId: true,
      requesterUserAgent: true,
      requesterIp: true,
      createdAt: true,
    },
  });
  if (!row) {
    throw notFound();
  }
  assertApprover(row.boundUserId, approverUserId);
  return toApprovalInfo(row);
}

export async function approveApproval(
  input: ResolveApprovalInput,
): Promise<void> {
  const row = await findByRef(input);
  assertApprover(row.boundUserId, input.approverUserId);
  const updated = await prisma.authApproval.updateMany({
    where: {
      id: row.id,
      status: AuthApprovalStatus.PENDING,
      expiresAt: { gt: new Date() },
    },
    data: {
      status: AuthApprovalStatus.APPROVED,
      approvedByUserId: input.approverUserId,
      resolvedAt: new Date(),
    },
  });
  if (updated.count === 0) {
    throw invalid();
  }
}

export async function declineApproval(
  input: ResolveApprovalInput,
): Promise<void> {
  const row = await findByRef(input);
  assertApprover(row.boundUserId, input.approverUserId);
  const updated = await prisma.authApproval.updateMany({
    where: { id: row.id, status: AuthApprovalStatus.PENDING },
    data: {
      status: AuthApprovalStatus.DECLINED,
      resolvedAt: new Date(),
    },
  });
  if (updated.count === 0) {
    throw invalid();
  }
}

export async function redeemApproval(
  token: string,
): Promise<RedeemApprovalResult> {
  const row = await prisma.authApproval.findUnique({
    where: { tokenHash: hashSecret(token) },
    select: { id: true, status: true, approvedByUserId: true },
  });
  if (!row || row.status !== AuthApprovalStatus.APPROVED || !row.approvedByUserId) {
    throw invalid();
  }

  const updated = await prisma.authApproval.updateMany({
    where: { id: row.id, status: AuthApprovalStatus.APPROVED },
    data: { status: AuthApprovalStatus.CONSUMED, consumedAt: new Date() },
  });
  if (updated.count === 0) {
    throw invalid();
  }

  return { userId: row.approvedByUserId };
}

export async function listIncomingApprovals(
  userId: string,
): Promise<IncomingApproval[]> {
  const rows = await prisma.authApproval.findMany({
    where: {
      boundUserId: userId,
      status: AuthApprovalStatus.PENDING,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      requesterUserAgent: true,
      requesterIp: true,
      createdAt: true,
      expiresAt: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    requesterUserAgent: row.requesterUserAgent,
    requesterIp: row.requesterIp,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  }));
}

async function findByRef(input: ResolveApprovalInput) {
  const row = input.token
    ? await prisma.authApproval.findUnique({
        where: { tokenHash: hashSecret(input.token) },
        select: { id: true, boundUserId: true },
      })
    : input.id
      ? await prisma.authApproval.findUnique({
          where: { id: input.id },
          select: { id: true, boundUserId: true },
        })
      : null;
  if (!row) {
    throw notFound();
  }
  return row;
}

function assertApprover(
  boundUserId: string | null,
  approverUserId: string,
): void {
  if (boundUserId && boundUserId !== approverUserId) {
    throw new AppServiceError(
      ApiErrorCode.Unauthorized,
      "You cannot approve this request",
    );
  }
}

function toPublicStatus(row: {
  status: AuthApprovalStatus;
  expiresAt: Date;
}): QrApprovalStatus {
  switch (row.status) {
    case AuthApprovalStatus.CONSUMED:
      return "consumed";
    case AuthApprovalStatus.DECLINED:
      return "declined";
    case AuthApprovalStatus.APPROVED:
      return "approved";
    default:
      return row.expiresAt.getTime() <= Date.now() ? "expired" : "pending";
  }
}

function toApprovalInfo(row: {
  status: AuthApprovalStatus;
  expiresAt: Date;
  boundUserId: string | null;
  requesterUserAgent: string | null;
  requesterIp: string | null;
  createdAt: Date;
}): ApprovalInfo {
  return {
    status: toPublicStatus(row),
    requesterUserAgent: row.requesterUserAgent,
    requesterIp: row.requesterIp,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    bound: Boolean(row.boundUserId),
  };
}

function notFound(): AppServiceError {
  return new AppServiceError(
    ApiErrorCode.NotFound,
    "Approval request not found",
  );
}

function invalid(): AppServiceError {
  return new AppServiceError(
    ApiErrorCode.Validation,
    "Invalid or expired approval request",
  );
}
