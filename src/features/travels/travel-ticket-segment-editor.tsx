"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import type { AnalyzedTicketSegment } from "@/lib/api/travels";
import { cn } from "@/lib/utils";
import type { TravelTicketDto } from "@/server/services/travel-service.types";

export type TicketSegmentDraft = {
  key: string;
  title: string;
  origin: string;
  destination: string;
  departsAt: string;
  arrivesAt: string;
  ticketNumber: string;
  flightNumber: string;
  bookingCode: string;
  seat: string;
};

export function TicketSegmentEditor({
  draft,
  onChange,
  index,
  canRemove = false,
  onRemove,
  showHeader = true,
}: {
  readonly draft: TicketSegmentDraft;
  readonly onChange: (next: TicketSegmentDraft) => void;
  readonly index?: number;
  readonly canRemove?: boolean;
  readonly onRemove?: () => void;
  readonly showHeader?: boolean;
}) {
  const t = useTranslations("travels");

  function patch(partial: Partial<TicketSegmentDraft>) {
    onChange({ ...draft, ...partial });
  }

  return (
    <div
      className={cn(
        "space-y-3",
        showHeader && "rounded-xl border border-border/60 p-3",
      )}
    >
      {showHeader ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">
            {t("ticketReviewSegment", { n: (index ?? 0) + 1 })}
          </p>
          {canRemove && onRemove ? (
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
      ) : null}
      <Field
        id={`${draft.key}-title`}
        label={t("ticketTitle")}
        value={draft.title}
        required
        onChange={(title) => patch({ title })}
      />
      <div className="grid grid-cols-2 gap-2">
        <Field
          id={`${draft.key}-origin`}
          label={t("ticketOrigin")}
          value={draft.origin}
          optional
          onChange={(origin) => patch({ origin })}
        />
        <Field
          id={`${draft.key}-destination`}
          label={t("ticketDestination")}
          value={draft.destination}
          optional
          onChange={(destination) => patch({ destination })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field
          id={`${draft.key}-departs`}
          label={t("ticketDepartsAt")}
          type="datetime-local"
          value={draft.departsAt}
          optional
          onChange={(departsAt) => patch({ departsAt })}
        />
        <Field
          id={`${draft.key}-arrives`}
          label={t("ticketArrivesAt")}
          type="datetime-local"
          value={draft.arrivesAt}
          optional
          onChange={(arrivesAt) => patch({ arrivesAt })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field
          id={`${draft.key}-flight`}
          label={t("ticketFlightNumber")}
          value={draft.flightNumber}
          optional
          onChange={(flightNumber) => patch({ flightNumber })}
        />
        <Field
          id={`${draft.key}-seat`}
          label={t("ticketSeat")}
          value={draft.seat}
          optional
          onChange={(seat) => patch({ seat })}
        />
      </div>
      <Field
        id={`${draft.key}-number`}
        label={t("ticketNumber")}
        value={draft.ticketNumber}
        optional
        onChange={(ticketNumber) => patch({ ticketNumber })}
      />
      <Field
        id={`${draft.key}-booking`}
        label={t("ticketBookingCode")}
        value={draft.bookingCode}
        optional
        onChange={(bookingCode) => patch({ bookingCode })}
      />
    </div>
  );
}

export function emptySegmentDraft(): TicketSegmentDraft {
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
    seat: "",
  };
}

export function segmentToDraft(
  segment: AnalyzedTicketSegment,
): TicketSegmentDraft {
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
    seat: segment.seat ?? "",
  };
}

export function ticketToDraft(ticket: TravelTicketDto): TicketSegmentDraft {
  return segmentToDraft({
    title: ticket.title,
    origin: ticket.origin,
    destination: ticket.destination,
    departsAt: ticket.departsAt,
    arrivesAt: ticket.arrivesAt,
    ticketNumber: ticket.ticketNumber,
    flightNumber: ticket.flightNumber,
    bookingCode: ticket.bookingCode,
    seat: ticket.seat,
  });
}

export function draftToSegment(
  draft: TicketSegmentDraft,
): AnalyzedTicketSegment {
  return {
    title: draft.title.trim(),
    origin: emptyToNull(draft.origin),
    destination: emptyToNull(draft.destination),
    departsAt: fromDatetimeLocal(draft.departsAt),
    arrivesAt: fromDatetimeLocal(draft.arrivesAt),
    ticketNumber: emptyToNull(draft.ticketNumber),
    flightNumber: emptyToNull(draft.flightNumber),
    bookingCode: emptyToNull(draft.bookingCode),
    seat: emptyToNull(draft.seat),
  };
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  required = false,
  optional = false,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly type?: "text" | "datetime-local";
  readonly required?: boolean;
  readonly optional?: boolean;
}) {
  return (
    <FormField
      label={label}
      htmlFor={id}
      required={required}
      optional={optional}
    >
      <Input
        id={id}
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
    </FormField>
  );
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
