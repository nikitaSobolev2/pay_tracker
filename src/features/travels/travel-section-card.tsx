import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { CardAction, CardHeader, CardTitle } from "@/components/ui/card";

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
    <CardHeader className="items-center border-b border-border/50 pb-3">
      <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
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
      {action ? <CardAction className="self-center">{action}</CardAction> : null}
    </CardHeader>
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
