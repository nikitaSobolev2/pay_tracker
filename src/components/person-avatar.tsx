"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  createPersonAvatarDataUri,
  initialsFromName,
} from "@/lib/dicebear-avatar";
import { cn } from "@/lib/utils";

export type PersonAvatarProps = {
  /** Stable id (userId / guestUserId) so rename does not change the face. */
  readonly seed: string;
  readonly name: string;
  readonly className?: string;
  readonly size?: "sm" | "default" | "lg";
};

export function PersonAvatar({
  seed,
  name,
  className,
  size = "default",
}: PersonAvatarProps) {
  const src = createPersonAvatarDataUri(seed || name);
  const initials = initialsFromName(name);

  return (
    <Avatar size={size} className={cn("bg-muted", className)}>
      <AvatarImage src={src} alt={name} />
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}
