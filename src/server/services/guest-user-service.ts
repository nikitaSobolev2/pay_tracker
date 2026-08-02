import { AppServiceError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { ApiErrorCode } from "@/types/api";
import { AppLocale } from "@/types/enums";
import type {
  EnsureGuestUserInput,
  GuestUserDto,
  RenameGuestUserInput,
} from "./guest-user-service.types";

const MAX_GUEST_NAME_LENGTH = 60;

export async function ensureGuestUser(
  input: EnsureGuestUserInput,
): Promise<GuestUserDto> {
  const existing = input.guestUserId
    ? await prisma.guestUser.findUnique({
        where: { id: input.guestUserId },
        select: { id: true, name: true },
      })
    : null;

  if (existing) {
    return input.name ? renameGuestUser({ guestUserId: existing.id, name: input.name }) : existing;
  }

  return prisma.guestUser.create({
    data: {
      name: normalizeGuestName(input.name ?? defaultGuestName(input.locale)),
      locale: input.locale,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    },
    select: { id: true, name: true },
  });
}

export async function renameGuestUser(
  input: RenameGuestUserInput,
): Promise<GuestUserDto> {
  const name = normalizeGuestName(input.name);
  const updated = await prisma.guestUser.updateMany({
    where: { id: input.guestUserId },
    data: { name },
  });
  if (updated.count === 0) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Guest not found");
  }
  return { id: input.guestUserId, name };
}

export async function touchGuestUser(guestUserId: string): Promise<void> {
  await prisma.guestUser.updateMany({
    where: { id: guestUserId },
    data: { lastSeenAt: new Date() },
  });
}

function defaultGuestName(locale: string): string {
  return locale === AppLocale.Ru ? "Гость" : "Guest";
}

function normalizeGuestName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new AppServiceError(ApiErrorCode.Validation, "Name is required");
  }
  return trimmed.slice(0, MAX_GUEST_NAME_LENGTH);
}
