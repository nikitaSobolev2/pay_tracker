import { Prisma } from "@prisma/client";

import { AppServiceError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  parseSharedChartPayload,
  type SharedChartPayload,
  type SharedChartType,
} from "@/features/share/shared-chart-payload";
import { ApiErrorCode } from "@/types/api";

export type SharedChartDto = {
  id: string;
  title: string | null;
  chartType: SharedChartType;
  payload: SharedChartPayload;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PublicSharedChartDto = {
  id: string;
  title: string | null;
  chartType: SharedChartType;
  payload: SharedChartPayload;
};

export async function createSharedChart(input: {
  userId: string;
  title?: string | null;
  payload: SharedChartPayload;
}): Promise<SharedChartDto> {
  const row = await prisma.sharedChart.create({
    data: {
      userId: input.userId,
      title: normalizeTitle(input.title),
      chartType: input.payload.type,
      payload: input.payload as Prisma.InputJsonValue,
      isPublic: false,
    },
  });
  return toDto(row);
}

export async function listSharedCharts(userId: string): Promise<SharedChartDto[]> {
  const rows = await prisma.sharedChart.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDto);
}

export async function updateSharedChart(input: {
  userId: string;
  id: string;
  title?: string | null;
  isPublic?: boolean;
}): Promise<SharedChartDto> {
  await assertOwnedShare(input.userId, input.id);
  const row = await prisma.sharedChart.update({
    where: { id: input.id },
    data: {
      ...(input.title !== undefined
        ? { title: normalizeTitle(input.title) }
        : {}),
      ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
    },
  });
  return toDto(row);
}

export async function deleteSharedChart(
  userId: string,
  id: string,
): Promise<void> {
  await assertOwnedShare(userId, id);
  await prisma.sharedChart.delete({ where: { id } });
}

export async function getPublicSharedChart(
  id: string,
): Promise<PublicSharedChartDto> {
  const row = await prisma.sharedChart.findUnique({ where: { id } });
  if (!row || !row.isPublic) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Shared chart not found");
  }
  return toPublicDto(row);
}

/** Owner can read unpublished; anyone can read public. */
export async function getSharedChartForViewer(input: {
  id: string;
  viewerUserId?: string | null;
}): Promise<PublicSharedChartDto> {
  const row = await prisma.sharedChart.findUnique({ where: { id: input.id } });
  if (!row) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Shared chart not found");
  }
  if (!row.isPublic && row.userId !== input.viewerUserId) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Shared chart not found");
  }
  return toPublicDto(row);
}

/** Returns owner context for public heatmap day drill-down. */
export async function getPublicHeatmapShareContext(id: string): Promise<{
  userId: string;
  timezone: string;
  displayCurrency: string;
  payload: Extract<SharedChartPayload, { type: "activityHeatmap" }>;
}> {
  const row = await prisma.sharedChart.findUnique({
    where: { id },
    include: {
      user: {
        select: { timezone: true, defaultCurrency: true },
      },
    },
  });
  if (!row || !row.isPublic) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Shared chart not found");
  }
  const payload = parseSharedChartPayload(row.payload);
  if (payload.type !== "activityHeatmap") {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Day drill-down is only available for activity heatmaps",
    );
  }
  return {
    userId: row.userId,
    timezone: row.user.timezone || "UTC",
    displayCurrency: row.user.defaultCurrency.toUpperCase(),
    payload,
  };
}

async function assertOwnedShare(userId: string, id: string): Promise<void> {
  const row = await prisma.sharedChart.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!row || row.userId !== userId) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Shared chart not found");
  }
}

function normalizeTitle(title: string | null | undefined): string | null {
  if (title == null) {
    return null;
  }
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 120) : null;
}

function toDto(row: {
  id: string;
  title: string | null;
  chartType: string;
  payload: Prisma.JsonValue;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SharedChartDto {
  return {
    id: row.id,
    title: row.title,
    chartType: row.chartType as SharedChartType,
    payload: parseSharedChartPayload(row.payload),
    isPublic: row.isPublic,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toPublicDto(row: {
  id: string;
  title: string | null;
  chartType: string;
  payload: Prisma.JsonValue;
}): PublicSharedChartDto {
  return {
    id: row.id,
    title: row.title,
    chartType: row.chartType as SharedChartType,
    payload: parseSharedChartPayload(row.payload),
  };
}
