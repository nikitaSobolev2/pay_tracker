"use client";

import type { ReactNode } from "react";

import { PageBlockTitleToggle } from "@/components/hideable-page-block";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ShareChartButton } from "@/features/share/share-chart-button";
import type { SharedChartPayload } from "@/features/share/shared-chart-payload";
import { usePageBlockHidden } from "@/hooks/use-page-block-hidden";
import { BENTO_LABEL_CLASS } from "@/lib/bento";
import { cn } from "@/lib/utils";

type StatCardProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  /** When set, shows a share control in the card header. */
  sharePayload?: SharedChartPayload | null;
  loading?: boolean;
  skeleton?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  bleed?: boolean;
  collapse?: { readonly scope: string; readonly blockId: string };
};

export function StatCard(props: StatCardProps) {
  if (props.collapse) {
    return <CollapsibleStatCard {...props} collapse={props.collapse} />;
  }
  return <StatCardFrame {...props} hidden={false} titleToggle={null} />;
}

function CollapsibleStatCard({
  collapse,
  ...props
}: StatCardProps & {
  readonly collapse: { readonly scope: string; readonly blockId: string };
}) {
  const { hidden, toggle } = usePageBlockHidden(collapse.scope, collapse.blockId);
  return (
    <StatCardFrame
      {...props}
      hidden={hidden}
      titleToggle={
        <PageBlockTitleToggle
          title={props.title}
          expanded={!hidden}
          onToggle={toggle}
        />
      }
    />
  );
}

function StatCardFrame({
  title,
  description,
  action,
  sharePayload,
  loading = false,
  skeleton,
  children,
  className,
  contentClassName,
  bleed = false,
  hidden,
  titleToggle,
}: StatCardProps & {
  readonly hidden: boolean;
  readonly titleToggle: ReactNode;
}) {
  const headerAction =
    action || sharePayload ? (
      <div className="flex items-center gap-1">
        {action}
        <ShareChartButton
          payload={sharePayload}
          title={title}
          disabled={loading}
        />
      </div>
    ) : null;

  return (
    <Card
      className={cn(
        "flex w-full min-w-0 flex-col overflow-hidden rounded-xl bg-card shadow-none",
        className,
      )}
    >
      <CardHeader className={cn("gap-1", bleed ? "pb-3" : "pb-2")}>
        {titleToggle ?? (
          <CardTitle className={BENTO_LABEL_CLASS}>{title}</CardTitle>
        )}
        {description && !hidden ? (
          <CardDescription className="text-xs sm:text-sm">
            {description}
          </CardDescription>
        ) : null}
        {headerAction ? <CardAction>{headerAction}</CardAction> : null}
      </CardHeader>
      <CardContent
        className={cn(
          hidden ? "hidden" : "flex flex-col",
          className?.includes("h-full") && "min-h-0 flex-1",
          bleed && "px-0 pb-0",
          contentClassName,
        )}
      >
        {loading ? (skeleton ?? <DefaultStatSkeleton bleed={bleed} />) : children}
      </CardContent>
    </Card>
  );
}

function DefaultStatSkeleton({ bleed }: { bleed: boolean }) {
  return (
    <Skeleton
      className={cn("w-full", bleed ? "h-52 rounded-none" : "h-48 rounded-xl")}
    />
  );
}
