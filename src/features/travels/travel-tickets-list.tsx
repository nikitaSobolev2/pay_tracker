"use client";

import { Eye, Pencil, Plus, Ticket, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import "react-swipeable-list/dist/styles.css";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ObjectActionList, ObjectSwipeRow, type ObjectSwipeInjectedProps } from "@/components/object-swipe-row";
import { RowOverflowMenu } from "@/components/row-overflow-menu";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import {
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogHeaderInner,
} from "@/components/ui/responsive-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { storeFileForOffline } from "@/lib/offline/travel-offline-files";
import { isNetworkError } from "@/lib/offline/travel-offline-execute";
import { enqueueTravelOp } from "@/lib/offline/travel-offline-sync";
import {
  analyzeTravelTicketFile,
  createTravelTicket,
  uploadTravelTicketFile,
  type AnalyzedTicketSegment,
} from "@/lib/api/travels";
import {
  makeLocalEntityId,
  removeTicketFromCache,
  upsertTicketInCache,
} from "@/stores/travel-cache.store";
import type { TravelTicketDto } from "@/server/services/travel-service.types";

import {
  TravelSectionEmpty,
  TravelSectionHeader,
} from "./travel-section-card";
import { TravelTicketAiReviewDialog } from "./travel-ticket-ai-review-dialog";
import { TravelTicketPass } from "./travel-ticket-pass";
import { TravelTicketPreviewDialog } from "./travel-ticket-preview-dialog";
import {
  draftToSegment,
  ticketToDraft,
  TicketSegmentEditor,
  type TicketSegmentDraft,
} from "./travel-ticket-segment-editor";
import {
  canAnalyzeTicketFile,
  emptyTicketMeta,
  segmentToTicketBody,
  ticketFileTitle,
} from "./travel-ticket-segment";

type TravelTicketsListProps = {
  readonly travelId: string;
  readonly items: readonly TravelTicketDto[];
  readonly onChanged: () => Promise<void>;
};

export function TravelTicketsList({
  travelId,
  items,
  onChanged,
}: TravelTicketsListProps) {
  const t = useTranslations("travels");
  const tCommon = useTranslations("common");
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<TravelTicketDto | null>(null);
  const [editing, setEditing] = useState<TravelTicketDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TravelTicketDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [askAnalyzeOpen, setAskAnalyzeOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewSegments, setReviewSegments] = useState<
    AnalyzedTicketSegment[]
  >([]);
  const [savingSegments, setSavingSegments] = useState(false);

  function handleFileSelected(file: File | undefined) {
    if (!file) {
      return;
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (canAnalyzeTicketFile(file.type)) {
      setPendingFile(file);
      setAskAnalyzeOpen(true);
      return;
    }
    void createSingleTicket(file);
  }

  async function createSingleTicket(file: File) {
    setUploading(true);
    try {
      await enqueueTicketRows(travelId, file, [
        {
          title: ticketFileTitle(file.name),
          ...emptyTicketMeta(),
        },
      ]);
      await onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("ticketUploadFailed"),
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleAnalyze() {
    if (!pendingFile) {
      return;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      toast.error(t("ticketAnalyzeNeedOnline"));
      setAskAnalyzeOpen(false);
      await createSingleTicket(pendingFile);
      setPendingFile(null);
      return;
    }
    setAnalyzing(true);
    try {
      const result = await analyzeTravelTicketFile(travelId, pendingFile);
      setReviewSegments(result.tickets);
      setAskAnalyzeOpen(false);
      setReviewOpen(true);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("ticketAnalyzeFailed"),
      );
      setAskAnalyzeOpen(false);
      await createSingleTicket(pendingFile);
      setPendingFile(null);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleReviewConfirm(segments: AnalyzedTicketSegment[]) {
    if (!pendingFile) {
      return;
    }
    setSavingSegments(true);
    try {
      await persistAnalyzedTickets(travelId, pendingFile, segments);
      await onChanged();
      setReviewOpen(false);
      setPendingFile(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("ticketUploadFailed"),
      );
    } finally {
      setSavingSegments(false);
    }
  }

  async function handleReviewSkip() {
    if (!pendingFile) {
      return;
    }
    setReviewOpen(false);
    const file = pendingFile;
    setPendingFile(null);
    await createSingleTicket(file);
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }
    setDeleting(true);
    removeTicketFromCache(travelId, deleteTarget.id);
    enqueueTravelOp({
      travelId,
      op: { kind: "deleteTicket", entityId: deleteTarget.id },
    });
    setDeleteTarget(null);
    await onChanged();
    setDeleting(false);
  }

  return (
    <>
      <Card className="border-border/60 bg-card/90 shadow-none">
        <TravelSectionHeader
          title={t("tickets")}
          count={items.length > 0 ? String(items.length) : undefined}
          action={
            <Button
              type="button"
              variant="outline"
              disabled={uploading || analyzing || savingSegments}
              onClick={() => fileInputRef.current?.click()}
            >
              <Plus className="size-4" />
              {analyzing
                ? t("ticketAnalyzeWorking")
                : uploading || savingSegments
                  ? t("ticketUploading")
                  : t("ticketAdd")}
            </Button>
          }
        />
        <CardContent className="space-y-3 p-3 sm:p-4">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
            onChange={(event) =>
              void handleFileSelected(event.target.files?.[0])
            }
          />
          {items.length === 0 ? (
            <TravelSectionEmpty icon={Ticket} text={t("ticketsEmpty")} />
          ) : (
            <ObjectActionList swipe={isMobile} variant="pass">
              {items.map((ticket) => (
                <TicketPassRow
                  key={ticket.id}
                  swipe={isMobile}
                  ticket={ticket}
                  onOpen={() => setPreview(ticket)}
                  onEdit={() => setEditing(ticket)}
                  onDelete={() => setDeleteTarget(ticket)}
                />
              ))}
            </ObjectActionList>
          )}
        </CardContent>
      </Card>

      <TravelTicketPreviewDialog
        ticket={preview}
        open={preview != null}
        onOpenChange={(nextOpen: boolean) => {
          if (!nextOpen) {
            setPreview(null);
          }
        }}
      />

      <AlertDialog
        open={askAnalyzeOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !analyzing) {
            setAskAnalyzeOpen(false);
            setPendingFile(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("ticketAnalyzeAskTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("ticketAnalyzeAskBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={analyzing}
              onClick={() => {
                const file = pendingFile;
                setAskAnalyzeOpen(false);
                setPendingFile(null);
                if (file) {
                  void createSingleTicket(file);
                }
              }}
            >
              {t("ticketAnalyzeSkip")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={analyzing}
              onClick={(event) => {
                event.preventDefault();
                void handleAnalyze();
              }}
            >
              {t("ticketAnalyzeYes")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TravelTicketAiReviewDialog
        open={reviewOpen}
        fileName={pendingFile?.name ?? ""}
        segments={reviewSegments}
        saving={savingSegments}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !savingSegments) {
            setReviewOpen(false);
            setPendingFile(null);
          }
        }}
        onConfirm={(segments) => void handleReviewConfirm(segments)}
        onSkip={() => void handleReviewSkip()}
      />

      <TicketEditDialog
        open={editing != null}
        ticket={editing}
        travelId={travelId}
        onOpenChange={(nextOpen: boolean) => {
          if (!nextOpen) {
            setEditing(null);
          }
        }}
        onSaved={async () => {
          setEditing(null);
          await onChanged();
        }}
      />

      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(nextOpen: boolean) => {
          if (!nextOpen) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("ticketDeleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("ticketDeleteConfirm", { title: deleteTarget?.title ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {tCommon("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
            >
              {t("ticketDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

async function persistAnalyzedTickets(
  travelId: string,
  file: File,
  segments: readonly AnalyzedTicketSegment[],
): Promise<void> {
  const online =
    typeof navigator === "undefined" || navigator.onLine !== false;
  if (online) {
    try {
      const uploaded = await uploadTravelTicketFile(file);
      for (const segment of segments) {
        await createTravelTicket(travelId, {
          title: segment.title,
          fileUrl: uploaded.url,
          fileName: uploaded.fileName,
          contentType: uploaded.contentType,
          ...segmentToTicketBody(segment),
        });
      }
      return;
    } catch (error) {
      if (!isNetworkError(error)) {
        throw error;
      }
    }
  }
  await enqueueTicketRows(travelId, file, segments);
}

async function enqueueTicketRows(
  travelId: string,
  file: File,
  segments: readonly AnalyzedTicketSegment[],
): Promise<void> {
  const fileId = await storeFileForOffline(file);
  const previewUrl = URL.createObjectURL(file);
  const now = new Date().toISOString();
  const contentType = file.type || "application/octet-stream";
  for (const segment of segments) {
    const entityLocalId = makeLocalEntityId();
    upsertTicketInCache(travelId, {
      id: entityLocalId,
      travelId,
      title: segment.title,
      fileUrl: previewUrl,
      fileName: file.name,
      contentType,
      origin: segment.origin,
      destination: segment.destination,
      departsAt: segment.departsAt,
      arrivesAt: segment.arrivesAt,
      ticketNumber: segment.ticketNumber,
      flightNumber: segment.flightNumber,
      bookingCode: segment.bookingCode,
      seat: segment.seat,
      createdAt: now,
      updatedAt: now,
    });
    enqueueTravelOp({
      travelId,
      op: {
        kind: "createTicket",
        entityLocalId,
        title: segment.title,
        fileId,
        fileName: file.name,
        contentType,
        segment: segmentToTicketBody(segment),
      },
    });
  }
}

function TicketPassRow({
  ticket,
  onOpen,
  onEdit,
  onDelete,
  swipe = false,
  ...swipeProps
}: {
  readonly ticket: TravelTicketDto;
  readonly onOpen: () => void;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
  readonly swipe?: boolean;
} & ObjectSwipeInjectedProps) {
  const t = useTranslations("travels");
  const tCommon = useTranslations("common");
  const pass = (
    <TravelTicketPass
      ticket={ticket}
      onOpen={onOpen}
      menu={
        <RowOverflowMenu
          actions={[
            {
              id: "open",
              label: t("ticketOpen"),
              icon: Eye,
              onSelect: onOpen,
            },
            {
              id: "edit",
              label: tCommon("edit"),
              icon: Pencil,
              onSelect: onEdit,
            },
            {
              id: "delete",
              label: tCommon("delete"),
              icon: Trash2,
              onSelect: onDelete,
              destructive: true,
            },
          ]}
        />
      }
    />
  );
  if (!swipe) {
    return pass;
  }
  return (
    <ObjectSwipeRow
      onEdit={onEdit}
      onDelete={onDelete}
      extraActions={[
        {
          id: "open",
          label: t("ticketOpen"),
          icon: Eye,
          onSelect: onOpen,
        },
      ]}
      {...swipeProps}
    >
      {pass}
    </ObjectSwipeRow>
  );
}

function TicketEditDialog({
  open,
  ticket,
  travelId,
  onOpenChange,
  onSaved,
}: {
  readonly open: boolean;
  readonly ticket: TravelTicketDto | null;
  readonly travelId: string;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSaved: () => Promise<void>;
}) {
  const t = useTranslations("travels");
  const tCommon = useTranslations("common");
  const [draft, setDraft] = useState<TicketSegmentDraft | null>(null);
  const [loaded, setLoaded] = useState(ticket);
  const [syncedOpen, setSyncedOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  if (open && !syncedOpen) {
    setSyncedOpen(true);
    setLoaded(ticket);
    setDraft(ticket ? ticketToDraft(ticket) : null);
  }
  if (!open && syncedOpen) {
    setSyncedOpen(false);
  }
  if (open && ticket !== loaded) {
    setLoaded(ticket);
    setDraft(ticket ? ticketToDraft(ticket) : null);
  }

  async function handleSave() {
    if (!ticket || !draft) {
      return;
    }
    const segment = draftToSegment(draft);
    if (!segment.title) {
      toast.error(t("ticketTitleRequired"));
      return;
    }
    setSaving(true);
    upsertTicketInCache(travelId, {
      ...ticket,
      title: segment.title,
      origin: segment.origin,
      destination: segment.destination,
      departsAt: segment.departsAt,
      arrivesAt: segment.arrivesAt,
      ticketNumber: segment.ticketNumber,
      flightNumber: segment.flightNumber,
      bookingCode: segment.bookingCode,
      seat: segment.seat,
      updatedAt: new Date().toISOString(),
    });
    enqueueTravelOp({
      travelId,
      op: {
        kind: "updateTicket",
        entityId: ticket.id,
        body: {
          title: segment.title,
          ...segmentToTicketBody(segment),
        },
      },
      baseline: ticketEditBaseline(ticket),
    });
    await onSaved();
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent size="md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogHeaderInner>
            <DialogTitle>{t("ticketEditTitle")}</DialogTitle>
          </ResponsiveDialogHeaderInner>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody>
          {draft ? (
            <TicketSegmentEditor
              draft={draft}
              showHeader={false}
              canRemove={false}
              onChange={setDraft}
            />
          ) : null}
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            className="h-11 rounded-xl"
            disabled={saving || !draft?.title.trim()}
            onClick={() => void handleSave()}
          >
            {tCommon("save")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}

function ticketEditBaseline(ticket: TravelTicketDto) {
  return {
    title: ticket.title,
    origin: ticket.origin,
    destination: ticket.destination,
    departsAt: ticket.departsAt,
    arrivesAt: ticket.arrivesAt,
    ticketNumber: ticket.ticketNumber,
    flightNumber: ticket.flightNumber,
    bookingCode: ticket.bookingCode,
    seat: ticket.seat,
  };
}
