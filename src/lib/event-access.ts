import { cookies } from "next/headers";

import { AppServiceError } from "@/lib/errors";
import { resolveOwnerName } from "@/lib/event-author";
import {
  readGuestIdCookie,
  readGuestRequestInfo,
  writeGuestIdCookie,
} from "@/lib/guest-session";
import { LOCALE_COOKIE_NAME } from "@/lib/locale-preference";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { ensureGuestUser } from "@/server/services/guest-user-service";
import { ApiErrorCode } from "@/types/api";
import {
  AppLocale,
  EventAuthorRole,
  EventGuestPermission,
  EventPublicity,
} from "@/types/enums";

export type EventAccessRow = {
  readonly id: string;
  readonly userId: string;
  readonly currency: string;
  readonly publicity: EventPublicity;
  readonly guestPermission: EventGuestPermission;
  readonly ownerDisplayName: string | null;
  readonly ownerName: string;
};

export type EventViewer = {
  readonly role: EventAuthorRole;
  readonly userId: string | null;
  readonly guestUserId: string | null;
  readonly displayName: string;
  readonly canEdit: boolean;
  readonly canManagePayments: boolean;
  /** True for any signed-in visitor, including one who does not own the event. */
  readonly isAuthenticated: boolean;
};

export type EventAccess = {
  readonly event: EventAccessRow;
  readonly viewer: EventViewer;
};

export type ResolveEventViewerInput = {
  readonly event: EventAccessRow;
  readonly sessionUserId: string | null;
  readonly guestUserId: string | null;
  readonly guestName: string | null;
};

/** Pure permission rule shared by routes and tests. Returns null when access is denied. */
export function resolveEventViewer(
  input: ResolveEventViewerInput,
): EventViewer | null {
  const { event } = input;
  if (input.sessionUserId && input.sessionUserId === event.userId) {
    return {
      role: EventAuthorRole.Owner,
      userId: event.userId,
      guestUserId: null,
      displayName: resolveOwnerName(event.ownerDisplayName, event.ownerName),
      canEdit: true,
      canManagePayments: true,
      isAuthenticated: true,
    };
  }

  if (event.publicity !== EventPublicity.Public) {
    return null;
  }

  const canEdit = event.guestPermission === EventGuestPermission.Edit;
  return {
    role: EventAuthorRole.Guest,
    userId: null,
    guestUserId: input.guestUserId,
    displayName: input.guestName ?? "Guest",
    canEdit,
    // Only the event owner records payments ("Add sum").
    canManagePayments: false,
    isAuthenticated: input.sessionUserId !== null,
  };
}

export function assertCanEdit(viewer: EventViewer): void {
  if (!viewer.canEdit) {
    throw new AppServiceError(
      ApiErrorCode.Forbidden,
      "This event is read-only for you",
    );
  }
}

export function assertCanManagePayments(viewer: EventViewer): void {
  if (!viewer.canManagePayments) {
    throw new AppServiceError(
      ApiErrorCode.Forbidden,
      "You cannot manage payments for this event",
    );
  }
}

export function assertIsOwner(viewer: EventViewer): void {
  if (viewer.role !== EventAuthorRole.Owner) {
    throw new AppServiceError(
      ApiErrorCode.Forbidden,
      "Only the event owner can do this",
    );
  }
}

/**
 * Resolves the current viewer of an event, creating a guest identity for public
 * events so every visitor can be shown in presence and can author messages.
 */
export async function requireEventAccess(eventId: string): Promise<EventAccess> {
  const event = await loadEventAccessRow(eventId);
  const sessionUser = await getSessionUser();

  const ownerViewer = resolveEventViewer({
    event,
    sessionUserId: sessionUser?.id ?? null,
    guestUserId: null,
    guestName: null,
  });
  if (ownerViewer?.role === EventAuthorRole.Owner) {
    return { event, viewer: ownerViewer };
  }

  if (event.publicity !== EventPublicity.Public) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Event not found");
  }

  const guest = await ensureCurrentGuest();
  const viewer = resolveEventViewer({
    event,
    sessionUserId: sessionUser?.id ?? null,
    guestUserId: guest.id,
    guestName: guest.name,
  });
  if (!viewer) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Event not found");
  }
  return { event, viewer };
}

export async function requireEventOwnerAccess(
  eventId: string,
): Promise<EventAccess> {
  const access = await requireEventAccess(eventId);
  assertIsOwner(access.viewer);
  return access;
}

export async function ensureCurrentGuest(): Promise<{
  id: string;
  name: string;
}> {
  const guestUserId = await readGuestIdCookie();
  const requestInfo = await readGuestRequestInfo();
  const guest = await ensureGuestUser({
    guestUserId,
    locale: await readLocale(),
    ipAddress: requestInfo.ipAddress,
    userAgent: requestInfo.userAgent,
  });
  if (guest.id !== guestUserId) {
    await writeGuestIdCookie(guest.id);
  }
  return guest;
}

async function loadEventAccessRow(eventId: string): Promise<EventAccessRow> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      userId: true,
      currency: true,
      publicity: true,
      guestPermission: true,
      ownerDisplayName: true,
      user: { select: { name: true } },
    },
  });
  if (!event) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Event not found");
  }
  return {
    id: event.id,
    userId: event.userId,
    currency: event.currency,
    publicity: event.publicity,
    guestPermission: event.guestPermission,
    ownerDisplayName: event.ownerDisplayName,
    ownerName: event.user.name,
  };
}

async function readLocale(): Promise<string> {
  const cookieStore = await cookies();
  return cookieStore.get(LOCALE_COOKIE_NAME)?.value ?? AppLocale.En;
}
