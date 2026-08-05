import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EventViewer } from "../../src/lib/event-access";
import { assertCanRemoveAttendee } from "../../src/server/services/attendee-auth";
import { AppServiceError } from "../../src/lib/errors";
import { EventAuthorRole } from "../../src/types/enums";

function viewer(partial: Partial<EventViewer> & Pick<EventViewer, "role">): EventViewer {
  return {
    userId: null,
    guestUserId: null,
    displayName: "Test",
    canEdit: false,
    canManagePayments: false,
    isAuthenticated: false,
    ...partial,
  };
}

describe("assertCanRemoveAttendee", () => {
  it("allows the owner to remove anyone", () => {
    assert.doesNotThrow(() =>
      assertCanRemoveAttendee(
        viewer({
          role: EventAuthorRole.Owner,
          userId: "owner",
          canEdit: true,
          canManagePayments: true,
        }),
        { authorUserId: null, authorGuestId: "guest-1" },
      ),
    );
  });

  it("allows a guest to remove a person they added", () => {
    assert.doesNotThrow(() =>
      assertCanRemoveAttendee(
        viewer({ role: EventAuthorRole.Guest, guestUserId: "guest-1" }),
        { authorUserId: null, authorGuestId: "guest-1" },
      ),
    );
  });

  it("blocks a guest from removing someone else", () => {
    assert.throws(
      () =>
        assertCanRemoveAttendee(
          viewer({ role: EventAuthorRole.Guest, guestUserId: "guest-1" }),
          { authorUserId: "owner", authorGuestId: null },
        ),
      (error: unknown) =>
        error instanceof AppServiceError && error.code === "FORBIDDEN",
    );
  });
});
