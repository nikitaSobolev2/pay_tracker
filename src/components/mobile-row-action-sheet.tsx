"use client";

import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type MobileRowAction = {
  readonly id: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly onSelect: () => void;
  readonly destructive?: boolean;
};

type MobileRowActionSheetProps = {
  readonly open: boolean;
  readonly title?: string;
  readonly actions: readonly MobileRowAction[];
  readonly onOpenChange: (open: boolean) => void;
};

export function MobileRowActionSheet({
  open,
  title,
  actions,
  onOpenChange,
}: MobileRowActionSheetProps) {
  const t = useTranslations("common");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="gap-0 rounded-t-2xl border-border/60 p-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="border-b border-border/50 px-4 py-3">
          <SheetTitle className="text-base">{title ?? t("rowActions")}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col p-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.id}
                type="button"
                variant="ghost"
                className={cn(
                  "h-12 min-h-12 w-full justify-start gap-3 rounded-xl px-3 text-base active:scale-95 motion-reduce:active:scale-100",
                  action.destructive && "text-destructive hover:text-destructive",
                )}
                onClick={() => {
                  onOpenChange(false);
                  action.onSelect();
                }}
              >
                <Icon className="size-4 shrink-0" />
                {action.label}
              </Button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
