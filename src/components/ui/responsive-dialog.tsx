"use client";

import type { ComponentProps } from "react";

import {
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const RESPONSIVE_DIALOG_CONTENT_CLASS = cn(
  // Layout chrome only. Position/size live in .ui-dialog-popup--responsive (globals.css).
  "ui-dialog-popup--responsive flex flex-col gap-0 overflow-hidden p-0",
);

type ResponsiveDialogContentProps = ComponentProps<typeof DialogContent> & {
  readonly size?: "md" | "xl" | "map";
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
      data-dialog-size={size}
      className={cn(RESPONSIVE_DIALOG_CONTENT_CLASS, className)}
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
        "sticky top-0 z-20 shrink-0 border-b border-border/60 bg-popover sm:rounded-t-2xl",
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
