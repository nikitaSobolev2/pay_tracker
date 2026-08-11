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
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  makeLocalEntityId,
  removePlaceFromCache,
  upsertPlaceInCache,
} from "@/stores/travel-cache.store";
import { enqueueTravelOp } from "@/lib/offline/travel-offline-sync";
import { cn } from "@/lib/utils";
import type { TravelPlaceToVisitDto } from "@/server/services/travel-service.types";

import {
  TravelSectionEmpty,
  TravelSectionHeader,
} from "./travel-section-card";

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
  const [togglingId, setTogglingId] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(item: TravelPlaceToVisitDto) {
    setEditing(item);
    setDialogOpen(true);
  }

  async function toggleChecked(item: TravelPlaceToVisitDto) {
    setTogglingId(item.id);
    const nextChecked = !item.isChecked;
    upsertPlaceInCache(travelId, {
      ...item,
      isChecked: nextChecked,
      updatedAt: new Date().toISOString(),
    });
    enqueueTravelOp({
      travelId,
      op: {
        kind: "updatePlace",
        entityId: item.id,
        body: { isChecked: nextChecked },
      },
      baseline: { isChecked: item.isChecked },
    });
    await onChanged();
    setTogglingId(null);
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }
    setDeleting(true);
    removePlaceFromCache(travelId, deleteTarget.id);
    enqueueTravelOp({
      travelId,
      op: { kind: "deletePlace", entityId: deleteTarget.id },
    });
    setDeleteTarget(null);
    await onChanged();
    setDeleting(false);
  }

  return (
    <>
      <Card className="border-border/60 bg-card/90 shadow-none">
        <TravelSectionHeader
          icon={MapPin}
          title={t("placesToVisit")}
          count={
            items.length > 0
              ? `${items.filter((item) => item.isChecked).length}/${items.length}`
              : undefined
          }
          action={
            <Button
              type="button"
              variant="outline"
              className="h-9 gap-1.5 rounded-lg"
              onClick={openCreate}
            >
              <Plus className="size-4" />
              {t("placeAdd")}
            </Button>
          }
        />
        <CardContent className="space-y-3 p-3 pt-3 sm:p-4">
          {items.length === 0 ? (
            <TravelSectionEmpty icon={MapPin} text={t("placesEmpty")} />
          ) : (
            <ul className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border/50">
              {items.map((item) => (
                <PlaceRow
                  key={item.id}
                  item={item}
                  toggling={togglingId === item.id}
                  onToggle={() => void toggleChecked(item)}
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
  toggling,
  onToggle,
  onEdit,
  onDelete,
}: {
  readonly item: TravelPlaceToVisitDto;
  readonly toggling: boolean;
  readonly onToggle: () => void;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}) {
  const t = useTranslations("travels");
  const tCommon = useTranslations("common");

  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 px-3 py-2 sm:gap-x-3">
      <Checkbox
        className="size-5"
        checked={item.isChecked}
        disabled={toggling}
        onCheckedChange={onToggle}
        aria-label={t("placeToggleChecked")}
      />
      <div className="min-w-0">
        <p
          className={cn(
            "truncate text-[15px] font-medium leading-snug",
            item.isChecked && "text-muted-foreground line-through",
          )}
        >
          {item.title}
        </p>
        {item.address ? (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0 opacity-70" />
            <span className="truncate">{item.address}</span>
          </p>
        ) : null}
        {item.link ? (
          <a
            href={item.link}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 flex max-w-full items-center gap-1 text-xs text-sky-600 hover:underline dark:text-sky-400"
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
          className="size-9 rounded-lg"
          aria-label={tCommon("edit")}
          onClick={onEdit}
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 rounded-lg text-destructive"
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
  const [values, setValues] = useState<PlaceFormValues>({
    title: item?.title ?? "",
    link: item?.link ?? "",
    address: item?.address ?? "",
  });
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
    const body = {
      title,
      link: link || null,
      address: values.address.trim() || null,
    };
    const now = new Date().toISOString();
    if (item) {
      upsertPlaceInCache(travelId, {
        ...item,
        ...body,
        updatedAt: now,
      });
      enqueueTravelOp({
        travelId,
        op: { kind: "updatePlace", entityId: item.id, body },
        baseline: {
          title: item.title,
          link: item.link,
          address: item.address,
        },
      });
    } else {
      const entityLocalId = makeLocalEntityId();
      upsertPlaceInCache(travelId, {
        id: entityLocalId,
        travelId,
        title: body.title,
        link: body.link,
        address: body.address,
        isChecked: false,
        createdAt: now,
        updatedAt: now,
      });
      enqueueTravelOp({
        travelId,
        op: { kind: "createPlace", entityLocalId, body },
      });
    }
    await onSaved();
    setSaving(false);
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
