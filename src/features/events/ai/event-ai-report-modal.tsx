"use client";

import { Check, Loader2, Plus, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import {
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogHeaderInner,
} from "@/components/ui/responsive-dialog";
import { applyEventMissingItemSuggestion } from "@/lib/api/events";
import { formatMoney } from "@/lib/money";
import { renderMarkdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import type {
  EventAiReportDto,
  EventAiSuggestedItemDto,
} from "@/server/services/event-service.types";
import { EventAiReportType, EventAuthorRole } from "@/types/enums";

import { useEventContext } from "../event-context";
import { CATEGORY_LABEL_KEYS } from "../event-spending-categories";
import {
  AI_RAINBOW_BORDER_CLASS,
  AI_RAINBOW_BORDER_STYLE,
  AI_RAINBOW_FILL_CLASS,
  AI_RAINBOW_TEXT_CLASS,
  AI_RAINBOW_TEXT_STYLE,
} from "./ai-styles";

export type EventAiReportModalProps = {
  readonly open: boolean;
  readonly report: EventAiReportDto;
  readonly onOpenChange: (open: boolean) => void;
};

export function EventAiReportModal({
  open,
  report,
  onOpenChange,
}: EventAiReportModalProps) {
  const t = useTranslations("events");
  const { event, viewer, refreshEvent } = useEventContext();
  const isOwner = viewer.role === EventAuthorRole.Owner;
  const isOk = report.type === EventAiReportType.Ok;
  const html = renderMarkdown(report.reportMessage);
  const suggestedItems = report.suggestedItems ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent size="xl" showCloseButton>
        <ResponsiveDialogHeader>
          <ResponsiveDialogHeaderInner>
            <DialogTitle className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight">
              <Sparkles className="size-5 text-fuchsia-400" />
              <span
                className={AI_RAINBOW_TEXT_CLASS}
                style={AI_RAINBOW_TEXT_STYLE}
              >
                {t("aiReportTitle")}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "rounded-full text-xs",
                  isOk
                    ? "border-emerald-500/40 text-emerald-400"
                    : "border-destructive/40 text-destructive",
                )}
              >
                {isOk ? t("aiReportOk") : t("aiReportBad")}
              </Badge>
            </DialogTitle>
          </ResponsiveDialogHeaderInner>
          <div className="pb-3" />
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody className="space-y-6">
          <div
            className="prose prose-sm dark:prose-invert max-w-none space-y-3 text-sm leading-relaxed [&_a]:text-primary [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base [&_li]:my-0.5 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: html }}
          />

          {suggestedItems.length > 0 ? (
            <section className="space-y-3">
              <h3 className="text-base font-semibold tracking-tight">
                {t("aiSuggestedItems")}
              </h3>
              <ul className="space-y-2">
                {suggestedItems.map((item) => (
                  <li key={item.id}>
                    <SuggestedItemCard
                      item={item}
                      currency={event.currency}
                      canAdd={isOwner}
                      onAdded={refreshEvent}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </Dialog>
  );
}

function SuggestedItemCard({
  item,
  currency,
  canAdd,
  onAdded,
}: {
  readonly item: EventAiSuggestedItemDto;
  readonly currency: string;
  readonly canAdd: boolean;
  readonly onAdded: () => Promise<void>;
}) {
  const t = useTranslations("events");
  const { event } = useEventContext();
  const [busy, setBusy] = useState(false);
  const added = item.addedAt !== null;

  async function add() {
    setBusy(true);
    try {
      await applyEventMissingItemSuggestion(event.id, item.id);
      await onAdded();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("aiSuggestedAddFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={AI_RAINBOW_BORDER_CLASS} style={AI_RAINBOW_BORDER_STYLE}>
      <div
        className={cn(
          AI_RAINBOW_FILL_CLASS,
          "flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between",
        )}
      >
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{item.title}</p>
            <Badge variant="outline" className="rounded-full text-[11px]">
              {t(CATEGORY_LABEL_KEYS[item.category])}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{item.reason}</p>
          <p className="text-xs tabular-nums text-foreground/80">
            {item.amount} {item.amountUnit} ·{" "}
            {formatMoney(item.price, currency)}
          </p>
        </div>
        {canAdd && added ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <Check className="size-3.5" />
            {t("aiSuggestedAdded")}
          </span>
        ) : null}
        {canAdd && !added ? (
          <Button
            type="button"
            size="sm"
            className="h-8 shrink-0 rounded-lg border-0 text-xs text-white"
            style={{
              backgroundImage: AI_RAINBOW_BORDER_STYLE.backgroundImage,
            }}
            disabled={busy}
            onClick={() => void add()}
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            {t("aiSuggestedAdd")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
