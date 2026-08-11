"use client";

import { ExternalLink, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
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
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  createPlaceToVisit,
  deletePlaceToVisit,
  updatePlaceToVisit,
} from "@/lib/api/travels";
import { cn } from "@/lib/utils";
import type { TravelPlaceToVisitDto } from "@/server/services/travel-service.types";

type TravelPlacesToVisitListProps = {
  readonly travelId: string;
  readonly items: readonly TravelPlaceToVisitDto[];
  readonly onChanged: () => Promise<void>;
};

type PlaceFormValues = {
  title: string;
  link: string;
  address: string;
};

export function TravelPlacesToVisitList({
  travelId,
  items,
  onChanged,
}: TravelPlacesToVisitListProps) {
  const t = useTranslations("travels");
  const tCommon = useTranslations("common");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TravelPlaceToVisitDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TravelPlaceToVisitDto | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(item: TravelPlaceToVisitDto) {
    setEditing(item);
    setDialogOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }
    setDeleting(true);
    try {
      await deletePlaceToVisit(travelId, deleteTarget.id);
      setDeleteTarget(null);
      await onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("placeDeleteFailed"),
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Card className="border-border/60 bg-card/90 shadow-none">
        <CardHeader className="border-b border-border/50 pb-3">
          <CardTitle className="text-base font-semibold tracking-tight">
            {t("placesToVisit")}
          </CardTitle>
          <CardAction>
            <Button
              type="button"
              size="sm"
              className="h-9 gap-1.5 rounded-xl"
              onClick={openCreate}
            >
              <Plus className="size-4" />
              {t("placeAdd")}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {t("placesEmpty")}
            </p>
          ) : (
            <ul className="divide-y divide-border/50">
              {items.map((item) => (
                <PlaceRow
                  key={item.id}
                  item={item}
                  onEdit={() => openEdit(item)}
                  onDelete={() => setDeleteTarget(item)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <PlaceFormDialog
        open={dialogOpen}
        travelId={travelId}
        item={editing}
        onOpenChange={setDialogOpen}
        onSaved={async () => {
          setDialogOpen(false);
          setEditing(null);
          await onChanged();
        }}
      />

      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("placeDeleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("placeDeleteConfirm", { title: deleteTarget?.title ?? "" })}
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
              {t("placeDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PlaceRow({
  item,
  onEdit,
  onDelete,
}: {
  readonly item: TravelPlaceToVisitDto;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}) {
  const t = useTranslations("travels");
  const tCommon = useTranslations("common");

  return (
    <li className="flex items-stretch gap-1 px-2 py-1.5 sm:px-3 sm:py-2.5">
      <div className="min-w-0 flex-1 px-1 py-1.5">
        <p className="truncate text-[15px] font-medium leading-snug">
          {item.title}
        </p>
        {item.address ? (
          <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 size-3 shrink-0 opacity-70" />
            <span className="line-clamp-2">{item.address}</span>
          </p>
        ) : null}
        {item.link ? (
          <a
            href={item.link}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex max-w-full items-center gap-1 text-xs text-sky-600 hover:underline dark:text-sky-400"
            onClick={(event) => event.stopPropagation()}
          >
            <ExternalLink className="size-3 shrink-0" />
            <span className="truncate">{displayLink(item.link)}</span>
          </a>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 rounded-xl"
          aria-label={tCommon("edit")}
          onClick={onEdit}
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 rounded-xl text-destructive"
          aria-label={t("placeDelete")}
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  );
}

function PlaceFormDialog({
  open,
  travelId,
  item,
  onOpenChange,
  onSaved,
}: {
  readonly open: boolean;
  readonly travelId: string;
  readonly item: TravelPlaceToVisitDto | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSaved: () => Promise<void>;
}) {
  const t = useTranslations("travels");
  const tCommon = useTranslations("common");
  const initial: PlaceFormValues = {
    title: item?.title ?? "",
    link: item?.link ?? "",
    address: item?.address ?? "",
  };
  const [values, setValues] = useState(initial);
  const [loadedItem, setLoadedItem] = useState(item);
  const [syncedOpen, setSyncedOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  if (open && !syncedOpen) {
    setSyncedOpen(true);
    setLoadedItem(item);
    setValues({
      title: item?.title ?? "",
      link: item?.link ?? "",
      address: item?.address ?? "",
    });
  }
  if (!open && syncedOpen) {
    setSyncedOpen(false);
  }
  if (open && item !== loadedItem) {
    setLoadedItem(item);
    setValues({
      title: item?.title ?? "",
      link: item?.link ?? "",
      address: item?.address ?? "",
    });
  }

  async function handleSave() {
    const title = values.title.trim();
    if (!title) {
      toast.error(t("placeTitleRequired"));
      return;
    }
    const link = values.link.trim();
    if (link && !isValidHttpUrl(link)) {
      toast.error(t("placeLinkInvalid"));
      return;
    }
    setSaving(true);
    try {
      const body = {
        title,
        link: link || null,
        address: values.address.trim() || null,
      };
      if (item) {
        await updatePlaceToVisit(travelId, item.id, body);
      } else {
        await createPlaceToVisit(travelId, body);
      }
      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("placeSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent size="md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogHeaderInner>
            <DialogTitle>
              {item ? t("placeEditTitle") : t("placeAddTitle")}
            </DialogTitle>
          </ResponsiveDialogHeaderInner>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="travel-place-title">{t("placeTitle")}</Label>
            <Input
              id="travel-place-title"
              value={values.title}
              className="h-12 rounded-xl text-base md:h-11"
              placeholder={t("placeTitlePlaceholder")}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, title: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="travel-place-link">{t("placeLink")}</Label>
            <Input
              id="travel-place-link"
              value={values.link}
              className="h-12 rounded-xl text-base md:h-11"
              placeholder={t("placeLinkPlaceholder")}
              inputMode="url"
              onChange={(event) =>
                setValues((prev) => ({ ...prev, link: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="travel-place-address">{t("placeAddress")}</Label>
            <Input
              id="travel-place-address"
              value={values.address}
              className="h-12 rounded-xl text-base md:h-11"
              placeholder={t("placeAddressPlaceholder")}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, address: event.target.value }))
              }
            />
          </div>
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
            className={cn("h-11 rounded-xl")}
            disabled={saving || !values.title.trim()}
            onClick={() => void handleSave()}
          >
            {tCommon("save")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}

function displayLink(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname + (parsed.pathname === "/" ? "" : parsed.pathname);
  } catch {
    return url;
  }
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
