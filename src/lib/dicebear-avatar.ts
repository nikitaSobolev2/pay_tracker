import { createAvatar } from "@dicebear/core";
import * as lorelei from "@dicebear/lorelei";

/** Deterministic face from a stable seed (user/guest id preferred over display name). */
export function createPersonAvatarDataUri(
  seed: string,
  size = 64,
): string {
  return createAvatar(lorelei, {
    seed: seed.trim() || "guest",
    size,
  }).toDataUri();
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "?";
}
