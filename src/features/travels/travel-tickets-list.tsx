"use client";

import { File, FileText, Pencil, Ticket, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogHeaderInner,
} from "@/components/ui/responsive-dialog";
import { storeFileForOffline } from "@/lib/offline/travel-offline-files";
import { enqueueTravelOp } from "@/lib/offline/travel-offline-sync";
import {
  makeLocalEntityId,
  removeTicketFromCache,
  upsertTicketInCache,
} from "@/stores/travel-cache.store";
import { cn } from "@/lib/utils";
import type { TravelTicketDto } from "@/server/services/travel-service.types";

import {
  ticketPreviewKind,
  type TicketPreviewKind,
} from "./travel-ticket-preview-kind";
import { TravelTicketPreviewDialog } from "./travel-ticket-preview-dialog";

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<TravelTicketDto | null>(null);
  const [editing, setEditing] = useState<TravelTicketDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TravelTicketDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleFileSelected(file: File | undefined) {
    if (!file) {
      return;
    }
    setUploading(true);
    try {
      const title = file.name.replace(/\.[^.]+$/, "") || file.name;
      const fileId = await storeFileForOffline(file);
      const previewUrl = URL.createObjectURL(file);
      const entityLocalId = makeLocalEntityId();
      const now = new Date().toISOString();
      upsertTicketInCache(travelId, {
        id: entityLocalId,
        travelId,
        title,
        fileUrl: previewUrl,
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        createdAt: now,
        updatedAt: now,
      });
      enqueueTravelOp({
        travelId,
        op: {
          kind: "createTicket",
          entityLocalId,
          title,
          fileId,
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
        },
      });
      await onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("ticketUploadFailed"),
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
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
        <CardHeader className="border-b border-border/50 pb-3">
          <CardTitle className="text-base font-semibold tracking-tight">
            {t("tickets")}
          </CardTitle>
        </CardHeader>
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
          <Button
            type="button"
            className="h-11 w-full gap-1.5 rounded-xl"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Ticket className="size-4" />
            {uploading ? t("ticketUploading") : t("ticketAdd")}
          </Button>
          {items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("ticketsEmpty")}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {items.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onOpen={() => setPreview(ticket)}
                  onEdit={() => setEditing(ticket)}
                  onDelete={() => setDeleteTarget(ticket)}
                />
              ))}
            </div>
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

      <TicketTitleDialog
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

function TicketCard({
  ticket,
  onOpen,
  onEdit,
  onDelete,
}: {
  readonly ticket: TravelTicketDto;
  readonly onOpen: () => void;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}) {
  const t = useTranslations("travels");
  const tCommon = useTranslations("common");
  const kind = ticketPreviewKind(ticket.contentType);

  return (
    <div className="relative w-full">
      <div className="relative flex h-28 w-full overflow-visible rounded-2xl shadow-[0_8px_24px_oklch(0_0_0/0.08)]">
        <div
          role="button"
          tabIndex={0}
          onClick={onOpen}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpen();
            }
          }}
          className={cn(
            "flex min-w-0 flex-[7] cursor-pointer flex-col justify-between rounded-l-2xl border border-r-0 border-border/70 bg-card px-3.5 py-3 text-left",
            "transition hover:bg-muted/30",
            "focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40",
          )}
        >
          <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-2.5">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
              {kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ticket.fileUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : kind === "pdf" ? (
                <FileText className="size-4" />
              ) : (
                <File className="size-4" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-snug">
                {ticket.title}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {ticket.fileName}
              </p>
            </div>
            <span className="justify-self-end text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {ticketTypeLabel(kind, t)}
            </span>
          </div>
          <div className="flex items-center justify-end gap-0.5 border-t border-dashed border-border/60 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 rounded-lg"
              aria-label={tCommon("edit")}
              onClick={(event) => {
                event.stopPropagation();
                onEdit();
              }}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 rounded-lg text-destructive"
              aria-label={t("ticketDelete")}
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute top-0 bottom-0 left-[70%] z-20 w-0"
        >
          <span className="absolute left-1/2 top-0 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-card shadow-[0_0_0_1px_oklch(0_0_0/0.06)] dark:shadow-[0_0_0_1px_oklch(1_0_0/0.08)]" />
          <span className="absolute left-1/2 bottom-0 size-4 -translate-x-1/2 translate-y-1/2 rounded-full bg-card shadow-[0_0_0_1px_oklch(0_0_0/0.06)] dark:shadow-[0_0_0_1px_oklch(1_0_0/0.08)]" />
          <span className="absolute left-1/2 top-4 bottom-4 w-px -translate-x-1/2 border-l border-dashed border-border/60" />
        </div>

        <button
          type="button"
          onClick={onOpen}
          className={cn(
            "relative flex w-[30%] shrink-0 items-center justify-center rounded-r-2xl bg-sky-600 px-2",
            "shadow-[4px_0_16px_oklch(0.55_0.14_230/0.28)]",
            "transition hover:bg-sky-500",
            "focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50",
          )}
        >
          <span className="rounded-full bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm">
            {t("ticketOpen")}
          </span>
        </button>
      </div>
    </div>
  );
}

function TicketTitleDialog({
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
  const [title, setTitle] = useState(ticket?.title ?? "");
  const [loaded, setLoaded] = useState(ticket);
  const [syncedOpen, setSyncedOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  if (open && !syncedOpen) {
    setSyncedOpen(true);
    setLoaded(ticket);
    setTitle(ticket?.title ?? "");
  }
  if (!open && syncedOpen) {
    setSyncedOpen(false);
  }
  if (open && ticket !== loaded) {
    setLoaded(ticket);
    setTitle(ticket?.title ?? "");
  }

  async function handleSave() {
    if (!ticket) {
      return;
    }
    const nextTitle = title.trim();
    if (!nextTitle) {
      toast.error(t("ticketTitleRequired"));
      return;
    }
    setSaving(true);
    upsertTicketInCache(travelId, {
      ...ticket,
      title: nextTitle,
      updatedAt: new Date().toISOString(),
    });
    enqueueTravelOp({
      travelId,
      op: {
        kind: "updateTicket",
        entityId: ticket.id,
        title: nextTitle,
      },
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
        <ResponsiveDialogBody className="space-y-2">
          <Label htmlFor="travel-ticket-title">{t("ticketTitle")}</Label>
          <Input
            id="travel-ticket-title"
            value={title}
            className="h-12 rounded-xl text-base md:h-11"
            onChange={(event) => setTitle(event.target.value)}
          />
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
            disabled={saving || !title.trim()}
            onClick={() => void handleSave()}
          >
            {tCommon("save")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}

function ticketTypeLabel(
  kind: TicketPreviewKind,
  t: ReturnType<typeof useTranslations<"travels">>,
): string {
  if (kind === "image") {
    return t("ticketTypeImage");
  }
  if (kind === "pdf") {
    return t("ticketTypePdf");
  }
  return t("ticketTypeFile");
}
