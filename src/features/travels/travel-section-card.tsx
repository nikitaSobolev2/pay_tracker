import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { CardTitle } from "@/components/ui/card";

type TravelSectionHeaderProps = {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly count?: string;
  readonly action?: ReactNode;
};

export function TravelSectionHeader({
  icon: Icon,
  title,
  count,
  action,
}: TravelSectionHeaderProps) {
  return (
    <div
      data-slot="card-header"
      className="flex flex-col gap-3 border-b border-border/50 px-(--card-spacing) pb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2"
    >
      <CardTitle className="flex min-w-0 items-center gap-2 text-base font-semibold tracking-tight">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{title}</span>
        {count ? (
          <Badge
            variant="secondary"
            className="rounded-full px-2 text-xs font-medium tabular-nums"
          >
            {count}
          </Badge>
        ) : null}
      </CardTitle>
      {action ? (
        <div className="w-full shrink-0 *:w-full sm:w-auto sm:*:w-auto">
          {action}
        </div>
      ) : null}
    </div>
  );
}

type TravelSectionEmptyProps = {
  readonly icon: LucideIcon;
  readonly text: string;
};

export function TravelSectionEmpty({
  icon: Icon,
  text,
}: TravelSectionEmptyProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/60 px-4 py-8 text-center">
      <Icon className="size-6 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
