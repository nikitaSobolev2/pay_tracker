"use client";

import { MoreVertical } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import type { MobileRowAction } from "@/components/mobile-row-action-sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type RowOverflowMenuProps = {
  readonly actions: readonly MobileRowAction[];
  readonly className?: string;
};

/** Desktop 3-dot actions. Hide on mobile with `hidden md:flex` from the caller. */
export function RowOverflowMenu({ actions, className }: RowOverflowMenuProps) {
  const tHeader = useTranslations("header");
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("shrink-0", className)}>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 rounded-xl"
              aria-label={tHeader("menu")}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            />
          }
        >
          <MoreVertical className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44 p-1.5">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <DropdownMenuItem
                key={action.id}
                variant={action.destructive ? "destructive" : "default"}
                className="min-h-12 gap-2.5 px-3 text-base"
                onClick={() => {
                  setOpen(false);
                  action.onSelect();
                }}
              >
                <Icon className="size-4" />
                {action.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
