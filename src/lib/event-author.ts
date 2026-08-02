import { EventAuthorRole } from "@/types/enums";

export type EventAuthorSource = {
  readonly ownerDisplayName: string | null;
  readonly ownerName: string;
  readonly authorUserId: string | null;
  readonly guestName: string | null;
  /** Analyzer output carries no author id, so it is flagged instead. */
  readonly isAiGenerated?: boolean;
};

export type EventAuthor = {
  readonly role: EventAuthorRole;
  readonly name: string;
};

const UNKNOWN_GUEST_NAME = "Guest";
const AI_AUTHOR_NAME = "AI";

/** Single naming rule for spendings, comments and chat messages. */
export function resolveAuthorName(source: EventAuthorSource): string {
  if (source.isAiGenerated) {
    return AI_AUTHOR_NAME;
  }
  if (source.authorUserId) {
    return source.ownerDisplayName?.trim() || source.ownerName;
  }
  return source.guestName?.trim() || UNKNOWN_GUEST_NAME;
}

export function resolveAuthor(source: EventAuthorSource): EventAuthor {
  return {
    role: resolveAuthorRole(source),
    name: resolveAuthorName(source),
  };
}

function resolveAuthorRole(source: EventAuthorSource): EventAuthorRole {
  if (source.isAiGenerated) {
    return EventAuthorRole.Ai;
  }
  return source.authorUserId ? EventAuthorRole.Owner : EventAuthorRole.Guest;
}

export function resolveOwnerName(
  ownerDisplayName: string | null,
  ownerName: string,
): string {
  return ownerDisplayName?.trim() || ownerName;
}
