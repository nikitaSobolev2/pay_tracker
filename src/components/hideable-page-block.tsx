"use client";

import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { usePageBlockHidden } from "@/hooks/use-page-block-hidden";
import { BENTO_LABEL_CLASS } from "@/lib/bento";
import { cn } from "@/lib/utils";

type PageBlockTitleToggleProps = {
  readonly title: string;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly count?: string;
  readonly className?: string;
};

export function PageBlockTitleToggle({
  title,
  expanded,
  onToggle,
  count,
  className,
}: PageBlockTitleToggleProps) {
  return (
    <button
      type="button"
      className={cn(
        "-ml-1 flex min-w-0 items-center gap-1.5 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-muted/60",
        className,
      )}
      aria-expanded={expanded}
      onClick={onToggle}
    >
      <ChevronRight
        className={cn(
          "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
          expanded && "rotate-90",
        )}
      />
      <span className={BENTO_LABEL_CLASS}>{title}</span>
      {count ? (
        <span className="text-xs tabular-nums text-muted-foreground">
          {count}
        </span>
      ) : null}
    </button>
  );
}

type HideablePageBlockProps = {
  readonly scope: string;
  readonly blockId: string;
  readonly title: string;
  readonly className?: string;
  readonly children: ReactNode;
};

export function HideablePageBlock({
  scope,
  blockId,
  title,
  className,
  children,
}: HideablePageBlockProps) {
  const { hidden, toggle } = usePageBlockHidden(scope, blockId);

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-col gap-2", className)}>
      <PageBlockTitleToggle
        title={title}
        expanded={!hidden}
        onToggle={toggle}
      />
      <div
        className={cn(hidden ? "hidden" : "min-h-0 min-w-0 flex-1")}
      >
        {children}
      </div>
    </div>
  );
}
