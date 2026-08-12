"use client";

import { ExternalLink, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TravelTicketDto } from "@/server/services/travel-service.types";

import {
  ticketPreviewKind,
  type TicketPreviewKind,
} from "./travel-ticket-preview-kind";

const TravelTicketPdfViewer = dynamic(
  () =>
    import("./travel-ticket-pdf-viewer").then((module) => module.TravelTicketPdfViewer),
  { ssr: false },
);

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
  const pdfFile = useTicketPdfBlob(open && kind === "pdf" ? ticket : null);

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

        <div
          className={
            kind === "pdf"
              ? "flex min-h-0 flex-1 flex-col overflow-hidden"
              : "flex min-h-0 flex-1 items-center justify-center p-3 sm:p-6"
          }
        >
          {ticket ? (
            <TicketPreviewBody ticket={ticket} kind={kind} pdf={pdfFile} />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type PdfBlobState = {
  readonly data: Blob | null;
  readonly failed: boolean;
  readonly loading: boolean;
};

function useTicketPdfBlob(ticket: TravelTicketDto | null): PdfBlobState {
  const [data, setData] = useState<Blob | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ticket) {
      setData(null);
      setFailed(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setData(null);

    void (async () => {
      try {
        const response = await fetch(ticket.fileUrl, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const blob = await response.blob();
        if (!cancelled) {
          setData(blob);
          setFailed(false);
        }
      } catch {
        if (!cancelled) {
          setData(null);
          setFailed(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ticket]);

  return { data, failed, loading };
}

function TicketPreviewBody({
  ticket,
  kind,
  pdf,
}: {
  readonly ticket: TravelTicketDto;
  readonly kind: TicketPreviewKind;
  readonly pdf: PdfBlobState;
}) {
  const t = useTranslations("travels");
  const [renderFailed, setRenderFailed] = useState(false);

  useEffect(() => {
    setRenderFailed(false);
  }, [ticket.id, pdf.data]);

  if (kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={ticket.fileUrl}
        alt={ticket.title}
        className="max-h-full max-w-full object-contain"
      />
    );
  }

  if (kind === "pdf") {
    const showFallback = pdf.failed || renderFailed;
    if (showFallback) {
      const offline =
        typeof navigator !== "undefined" && navigator.onLine === false;
      return (
        <div className="flex flex-1 items-center justify-center p-3 sm:p-6">
          <TicketFallback
            fileName={ticket.fileName}
            fileUrl={ticket.fileUrl}
            message={
              offline ? t("ticketPreviewOffline") : t("ticketPreviewUnavailable")
            }
            openLabel={t("ticketOpenFile")}
          />
        </div>
      );
    }
    if (pdf.data) {
      return (
        <TravelTicketPdfViewer
          key={ticket.id}
          file={pdf.data}
          title={ticket.title}
          onLoadError={() => setRenderFailed(true)}
        />
      );
    }
    if (pdf.loading) {
      return (
        <p className="flex flex-1 items-center justify-center text-sm text-white/60">
          {t("ticketPreviewLoading")}
        </p>
      );
    }
    return null;
  }

  return (
    <TicketFallback
      fileName={ticket.fileName}
      fileUrl={ticket.fileUrl}
      message={t("ticketPreviewUnavailable")}
      openLabel={t("ticketOpenFile")}
    />
  );
}

function TicketFallback({
  fileName,
  fileUrl,
  message,
  openLabel,
}: {
  readonly fileName: string;
  readonly fileUrl: string;
  readonly message: string;
  readonly openLabel: string;
}) {
  return (
    <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl border border-white/15 bg-white/5 px-6 py-8 text-center">
      <p className="text-sm text-white/80">{fileName}</p>
      <p className="text-sm text-white/60">{message}</p>
      <a
        href={fileUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-11 items-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-medium text-white hover:bg-sky-500"
      >
        <ExternalLink className="size-4" />
        {openLabel}
      </a>
    </div>
  );
}
