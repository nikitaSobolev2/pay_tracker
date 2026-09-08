"use client";

import type { ReactNode } from "react";

import { PageBlockTitleToggle } from "@/components/hideable-page-block";
import { Card, CardAction, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { useEventPageBlockHidden } from "./use-event-page-block-hidden";

type EventCollapsibleCardHeaderProps = {
  readonly title: string;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly count?: string;
  readonly action?: ReactNode;
  readonly className?: string;
};

export function EventCollapsibleCardHeader({
  title,
  expanded,
  onToggle,
  count,
  action,
  className,
}: EventCollapsibleCardHeaderProps) {
  return (
    <CardHeader className={className}>
      <PageBlockTitleToggle
        title={title}
        count={count}
        expanded={expanded}
        onToggle={onToggle}
      />
      {action ? <CardAction>{action}</CardAction> : null}
    </CardHeader>
  );
}

type EventCollapsibleCardProps = {
  readonly blockId: string;
  readonly title: string;
  readonly count?: string;
  readonly action?: ReactNode;
  readonly className?: string;
  readonly children: ReactNode;
};

export function EventCollapsibleCard({
  blockId,
  title,
  count,
  action,
  className,
  children,
}: EventCollapsibleCardProps) {
  const { hidden, toggle } = useEventPageBlockHidden(blockId);

  return (
    <Card className={cn(className, hidden && "h-auto min-h-0 self-start")}>
      <EventCollapsibleCardHeader
        title={title}
        count={count}
        expanded={!hidden}
        onToggle={toggle}
        action={action}
      />
      <div
        className={hidden ? "hidden" : "flex min-h-0 min-w-0 flex-1 flex-col"}
      >
        {children}
      </div>
    </Card>
  );
}
