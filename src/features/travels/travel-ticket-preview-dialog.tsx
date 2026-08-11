"use client";

import { ExternalLink, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TravelTicketDto } from "@/server/services/travel-service.types";

import { ticketPreviewKind } from "./travel-ticket-preview-kind";

type TravelTicketPreviewDialogProps = {
  readonly ticket: TravelTicketDto | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

export function TravelTicketPreviewDialog({
  ticket,
  open,
  onOpenChange,
}: TravelTicketPreviewDialogProps) {
  const t = useTranslations("travels");
  const kind = ticket ? ticketPreviewKind(ticket.contentType) : "other";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="ui-dialog-popup--ticket-preview flex flex-col bg-black/95 text-white ring-0"
        overlayClassName="bg-black/90"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <DialogTitle className="truncate text-base font-semibold text-white">
            {ticket?.title ?? t("tickets")}
          </DialogTitle>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 shrink-0 rounded-xl text-white hover:bg-white/10"
            aria-label={t("ticketPreviewClose")}
            onClick={() => onOpenChange(false)}
          >
            <X className="size-5" />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center p-3 sm:p-6">
          {!ticket ? null : kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ticket.fileUrl}
              alt={ticket.title}
              className="max-h-full max-w-full object-contain"
            />
          ) : kind === "pdf" ? (
            <iframe
              title={ticket.title}
              src={ticket.fileUrl}
              className="h-full w-full rounded-lg bg-white"
            />
          ) : (
            <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl border border-white/15 bg-white/5 px-6 py-8 text-center">
              <p className="text-sm text-white/80">{ticket.fileName}</p>
              <p className="text-sm text-white/60">{t("ticketPreviewUnavailable")}</p>
              <a
                href={ticket.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-medium text-white hover:bg-sky-500"
              >
                <ExternalLink className="size-4" />
                {t("ticketOpenFile")}
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
