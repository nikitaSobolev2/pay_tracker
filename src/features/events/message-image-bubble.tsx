"use client";

import { cn } from "@/lib/utils";

export type MessageImageBubbleProps = {
  readonly imageUrl: string;
  readonly className?: string;
  readonly alignEnd?: boolean;
};

/** Large image-only bubble for chat and spending-thread attachments. */
export function MessageImageBubble({
  imageUrl,
  className,
  alignEnd = false,
}: MessageImageBubbleProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border/50 bg-muted/40",
        alignEnd ? "ml-auto" : "mr-auto",
        className,
      )}
    >
      {/* Storage subdomain is not configured for next/image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt=""
        className="max-h-80 w-full max-w-sm object-contain sm:max-h-96"
      />
    </div>
  );
}
