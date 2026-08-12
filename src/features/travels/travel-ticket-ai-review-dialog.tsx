"use client";

import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogHeaderInner,
} from "@/components/ui/responsive-dialog";
import type { AnalyzedTicketSegment } from "@/lib/api/travels";

type TicketSegmentDraft = {
  key: string;
  title: string;
  origin: string;
  destination: string;
  departsAt: string;
  arrivesAt: string;
  ticketNumber: string;
  flightNumber: string;
  bookingCode: string;
};

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
    setDrafts(segments.map(toDraft));
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
        <ResponsiveDialogBody className="space-y-4">
          {drafts.map((draft, index) => (
            <SegmentEditor
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
            onClick={() => setDrafts((current) => [...current, emptyDraft()])}
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
            onClick={() => onConfirm(drafts.map(fromDraft))}
          >
            {t("ticketReviewConfirm")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}

function SegmentEditor({
  draft,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  readonly draft: TicketSegmentDraft;
  readonly index: number;
  readonly canRemove: boolean;
  readonly onChange: (next: TicketSegmentDraft) => void;
  readonly onRemove: () => void;
}) {
  const t = useTranslations("travels");

  function patch(partial: Partial<TicketSegmentDraft>) {
    onChange({ ...draft, ...partial });
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {t("ticketReviewSegment", { n: index + 1 })}
        </p>
        {canRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-destructive"
            aria-label={t("ticketReviewRemoveSegment")}
            onClick={onRemove}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>
      <Field
        id={`${draft.key}-title`}
        label={t("ticketTitle")}
        value={draft.title}
        onChange={(title) => patch({ title })}
      />
      <div className="grid grid-cols-2 gap-2">
        <Field
          id={`${draft.key}-origin`}
          label={t("ticketOrigin")}
          value={draft.origin}
          onChange={(origin) => patch({ origin })}
        />
        <Field
          id={`${draft.key}-destination`}
          label={t("ticketDestination")}
          value={draft.destination}
          onChange={(destination) => patch({ destination })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field
          id={`${draft.key}-departs`}
          label={t("ticketDepartsAt")}
          type="datetime-local"
          value={draft.departsAt}
          onChange={(departsAt) => patch({ departsAt })}
        />
        <Field
          id={`${draft.key}-arrives`}
          label={t("ticketArrivesAt")}
          type="datetime-local"
          value={draft.arrivesAt}
          onChange={(arrivesAt) => patch({ arrivesAt })}
        />
      </div>
      <Field
        id={`${draft.key}-flight`}
        label={t("ticketFlightNumber")}
        value={draft.flightNumber}
        onChange={(flightNumber) => patch({ flightNumber })}
      />
      <Field
        id={`${draft.key}-number`}
        label={t("ticketNumber")}
        value={draft.ticketNumber}
        onChange={(ticketNumber) => patch({ ticketNumber })}
      />
      <Field
        id={`${draft.key}-booking`}
        label={t("ticketBookingCode")}
        value={draft.bookingCode}
        onChange={(bookingCode) => patch({ bookingCode })}
      />
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly type?: "text" | "datetime-local";
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-xl"
      />
    </div>
  );
}

function toDraft(segment: AnalyzedTicketSegment): TicketSegmentDraft {
  return {
    key: crypto.randomUUID(),
    title: segment.title,
    origin: segment.origin ?? "",
    destination: segment.destination ?? "",
    departsAt: toDatetimeLocal(segment.departsAt),
    arrivesAt: toDatetimeLocal(segment.arrivesAt),
    ticketNumber: segment.ticketNumber ?? "",
    flightNumber: segment.flightNumber ?? "",
    bookingCode: segment.bookingCode ?? "",
  };
}

function fromDraft(draft: TicketSegmentDraft): AnalyzedTicketSegment {
  return {
    title: draft.title.trim(),
    origin: emptyToNull(draft.origin),
    destination: emptyToNull(draft.destination),
    departsAt: fromDatetimeLocal(draft.departsAt),
    arrivesAt: fromDatetimeLocal(draft.arrivesAt),
    ticketNumber: emptyToNull(draft.ticketNumber),
    flightNumber: emptyToNull(draft.flightNumber),
    bookingCode: emptyToNull(draft.bookingCode),
  };
}

function emptyDraft(): TicketSegmentDraft {
  return {
    key: crypto.randomUUID(),
    title: "",
    origin: "",
    destination: "",
    departsAt: "",
    arrivesAt: "",
    ticketNumber: "",
    flightNumber: "",
    bookingCode: "",
  };
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso.slice(0, 16);
  }
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocal(value: string): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
