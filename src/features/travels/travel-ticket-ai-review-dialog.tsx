"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import {
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogHeaderInner,
} from "@/components/ui/responsive-dialog";
import type { AnalyzedTicketSegment } from "@/lib/api/travels";

import {
  draftToSegment,
  emptySegmentDraft,
  segmentToDraft,
  TicketSegmentEditor,
  type TicketSegmentDraft,
} from "./travel-ticket-segment-editor";

type TravelTicketAiReviewDialogProps = {
  readonly open: boolean;
  readonly fileName: string;
  readonly segments: readonly AnalyzedTicketSegment[];
  readonly saving: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: (segments: AnalyzedTicketSegment[]) => void;
  readonly onSkip: () => void;
};

export function TravelTicketAiReviewDialog({
  open,
  fileName,
  segments,
  saving,
  onOpenChange,
  onConfirm,
  onSkip,
}: TravelTicketAiReviewDialogProps) {
  const t = useTranslations("travels");
  const [drafts, setDrafts] = useState<TicketSegmentDraft[]>([]);
  const [syncedOpen, setSyncedOpen] = useState(false);
  const [loadedSegments, setLoadedSegments] = useState(segments);

  if (open && (!syncedOpen || segments !== loadedSegments)) {
    setSyncedOpen(true);
    setLoadedSegments(segments);
    setDrafts(segments.map(segmentToDraft));
  }
  if (!open && syncedOpen) {
    setSyncedOpen(false);
  }

  const canConfirm =
    drafts.length > 0 && drafts.every((draft) => draft.title.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent
        showCloseButton
        className="sm:max-w-lg"
        overlayClassName="bg-black/50"
      >
        <ResponsiveDialogHeader>
          <ResponsiveDialogHeaderInner>
            <DialogTitle>{t("ticketReviewTitle")}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {t("ticketReviewHint", { fileName })}
            </p>
          </ResponsiveDialogHeaderInner>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody>
          {drafts.map((draft, index) => (
            <TicketSegmentEditor
              key={draft.key}
              draft={draft}
              index={index}
              canRemove={drafts.length > 1}
              onChange={(next) =>
                setDrafts((current) =>
                  current.map((row) => (row.key === draft.key ? next : row)),
                )
              }
              onRemove={() =>
                setDrafts((current) =>
                  current.filter((row) => row.key !== draft.key),
                )
              }
            />
          ))}
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full gap-1.5 rounded-xl"
            onClick={() => setDrafts((current) => [...current, emptySegmentDraft()])}
          >
            <Plus className="size-4" />
            {t("ticketReviewAddSegment")}
          </Button>
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={saving}
            onClick={onSkip}
          >
            {t("ticketAnalyzeSkip")}
          </Button>
          <Button
            type="button"
            disabled={saving || !canConfirm}
            onClick={() => onConfirm(drafts.map(draftToSegment))}
          >
            {t("ticketReviewConfirm")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
