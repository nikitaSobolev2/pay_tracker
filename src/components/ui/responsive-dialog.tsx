"use client";

import type { ComponentProps } from "react";

import {
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const RESPONSIVE_DIALOG_CONTENT_CLASS = cn(
  "flex flex-col gap-0 overflow-hidden p-0",
  // Mobile: full-bleed — use vw so scroll-lock gutter does not leave a right strip
  "top-0 right-0 bottom-0 left-0 h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 rounded-none",
  "sm:top-1/2 sm:right-auto sm:bottom-auto sm:left-1/2 sm:h-auto sm:max-h-[92svh] sm:w-full",
  "sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl",
);

type ResponsiveDialogContentProps = ComponentProps<typeof DialogContent> & {
  readonly size?: "md" | "xl";
};

/** Full-viewport on mobile, centered card on sm+. */
export function ResponsiveDialogContent({
  className,
  size = "xl",
  showCloseButton = true,
  ...props
}: ResponsiveDialogContentProps) {
  return (
    <DialogContent
      showCloseButton={showCloseButton}
      className={cn(
        RESPONSIVE_DIALOG_CONTENT_CLASS,
        size === "md" ? "sm:max-w-md" : "sm:max-w-xl",
        className,
      )}
      {...props}
    />
  );
}

export function ResponsiveDialogHeader({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "sticky top-0 z-20 shrink-0 border-b border-border/60 bg-popover",
        className,
      )}
      {...props}
    />
  );
}

export function ResponsiveDialogHeaderInner({
  className,
  ...props
}: ComponentProps<typeof DialogHeader>) {
  return (
    <DialogHeader
      className={cn("gap-3 px-4 pt-4 pr-12 sm:px-5", className)}
      {...props}
    />
  );
}

export function ResponsiveDialogBody({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4 sm:px-5",
        className,
      )}
      {...props}
    />
  );
}

export function ResponsiveDialogFooter({
  className,
  ...props
}: ComponentProps<typeof DialogFooter>) {
  return (
    <DialogFooter
      className={cn(
        "relative z-20 mx-0 mb-0 shrink-0 flex-col gap-2 rounded-none border-t bg-muted/50 p-4 sm:flex-row sm:rounded-b-2xl sm:gap-2",
        className,
      )}
      {...props}
    />
  );
}
