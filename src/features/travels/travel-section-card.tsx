"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { PageBlockTitleToggle } from "@/components/hideable-page-block";
import { CardTitle } from "@/components/ui/card";
import { usePageBlockHidden } from "@/hooks/use-page-block-hidden";
import { BENTO_LABEL_CLASS } from "@/lib/bento";

type TravelSectionHeaderProps = {
  readonly title: string;
  readonly count?: string;
  readonly action?: ReactNode;
  readonly expanded?: boolean;
  readonly onToggle?: () => void;
};

export function TravelSectionHeader({
  title,
  count,
  action,
  expanded = true,
  onToggle,
}: TravelSectionHeaderProps) {
  return (
    <div
      data-slot="card-header"
      className="flex flex-col gap-3 px-(--card-spacing) pb-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2"
    >
      {onToggle ? (
        <PageBlockTitleToggle
          title={title}
          count={count}
          expanded={expanded}
          onToggle={onToggle}
        />
      ) : (
        <CardTitle className="flex min-w-0 items-baseline gap-2">
          <span className={BENTO_LABEL_CLASS}>{title}</span>
          {count ? (
            <span className="text-xs tabular-nums text-muted-foreground">
              {count}
            </span>
          ) : null}
        </CardTitle>
      )}
      {action ? (
        <div className="w-full shrink-0 *:w-full sm:w-auto sm:*:w-auto">
          {action}
        </div>
      ) : null}
    </div>
  );
}

type CollapsibleTravelSectionProps = {
  readonly scope: string;
  readonly blockId: string;
  readonly title: string;
  readonly count?: string;
  readonly action?: ReactNode;
  readonly children: ReactNode;
};

export function CollapsibleTravelSection({
  scope,
  blockId,
  title,
  count,
  action,
  children,
}: CollapsibleTravelSectionProps) {
  const { hidden, toggle } = usePageBlockHidden(scope, blockId);
  return (
    <>
      <TravelSectionHeader
        title={title}
        count={count}
        action={action}
        expanded={!hidden}
        onToggle={toggle}
      />
      <div className={hidden ? "hidden" : undefined}>{children}</div>
    </>
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
    <div className="flex flex-col items-center gap-2 rounded-xl px-4 py-8 text-center ring-1 ring-foreground/10">
      <Icon className="size-5 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
