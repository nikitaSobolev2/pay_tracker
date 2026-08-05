import type { EventViewer } from "@/lib/event-access";
import { AppServiceError } from "@/lib/errors";
import { ApiErrorCode } from "@/types/api";
import { EventAuthorRole } from "@/types/enums";

export function assertCanRemoveAttendee(
  viewer: EventViewer,
  attendee: {
    readonly authorUserId: string | null;
    readonly authorGuestId: string | null;
  },
): void {
  if (viewer.role === EventAuthorRole.Owner) {
    return;
  }
  if (
    viewer.guestUserId &&
    attendee.authorGuestId &&
    viewer.guestUserId === attendee.authorGuestId
  ) {
    return;
  }
  throw new AppServiceError(
    ApiErrorCode.Forbidden,
    "You can only remove people you added",
  );
}
