"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
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
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  removeThingFromCache,
  upsertThingInCache,
} from "@/stores/travel-cache.store";
import { enqueueTravelOp } from "@/lib/offline/travel-offline-sync";
import { cn } from "@/lib/utils";
import type { TravelThingToGrabDto } from "@/server/services/travel-service.types";

type TravelThingsToGrabListProps = {
  readonly travelId: string;
  readonly items: readonly TravelThingToGrabDto[];
  readonly onChanged: () => Promise<void>;
};

type GrabFormValues = {
  title: string;
  amount: string;
};

export function TravelThingsToGrabList({
  travelId,
  items,
  onChanged,
}: TravelThingsToGrabListProps) {
  const t = useTranslations("travels");
  const tCommon = useTranslations("common");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TravelThingToGrabDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TravelThingToGrabDto | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(item: TravelThingToGrabDto) {
    setEditing(item);
    setDialogOpen(true);
  }

  async function toggleChecked(item: TravelThingToGrabDto) {
    setTogglingId(item.id);
    const nextChecked = !item.isChecked;
    upsertThingInCache(travelId, {
      ...item,
      isChecked: nextChecked,
      updatedAt: new Date().toISOString(),
    });
    enqueueTravelOp({
      travelId,
      op: {
        kind: "updateThing",
        entityId: item.id,
        body: { isChecked: nextChecked },
      },
    });
    await onChanged();
    setTogglingId(null);
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }
    setDeleting(true);
    removeThingFromCache(travelId, deleteTarget.id);
    enqueueTravelOp({
      travelId,
      op: { kind: "deleteThing", entityId: deleteTarget.id },
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
            {t("thingsToGrab")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-3 pt-3 sm:p-4">
          <Button
            type="button"
            className="h-11 w-full gap-1.5 rounded-xl"
            onClick={openCreate}
          >
            <Plus className="size-4" />
            {t("grabAdd")}
          </Button>
          {items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("grabsEmpty")}
            </p>
          ) : (
            <ul className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border/50">
              {items.map((item) => (
                <GrabRow
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

      <GrabFormDialog
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
            <AlertDialogTitle>{t("grabDeleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("grabDeleteConfirm", { title: deleteTarget?.title ?? "" })}
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
              {t("grabDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function GrabRow({
  item,
  toggling,
  onToggle,
  onEdit,
  onDelete,
}: {
  readonly item: TravelThingToGrabDto;
  readonly toggling: boolean;
  readonly onToggle: () => void;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}) {
  const t = useTranslations("travels");
  const tCommon = useTranslations("common");

  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-2 px-3 py-2.5 sm:gap-x-3">
      <Checkbox
        className="size-5"
        checked={item.isChecked}
        disabled={toggling}
        onCheckedChange={onToggle}
        aria-label={t("grabToggleChecked")}
      />
      <p
        className={cn(
          "min-w-0 truncate text-[15px] font-medium leading-snug",
          item.isChecked && "text-muted-foreground line-through",
        )}
      >
        {item.title}
      </p>
      <p
        className={cn(
          "justify-self-end text-sm font-medium tabular-nums text-muted-foreground",
          item.isChecked && "line-through",
        )}
      >
        {t("grabQuantityValue", { count: item.amount })}
      </p>
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
          aria-label={t("grabDelete")}
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  );
}

function GrabFormDialog({
  open,
  travelId,
  item,
  onOpenChange,
  onSaved,
}: {
  readonly open: boolean;
  readonly travelId: string;
  readonly item: TravelThingToGrabDto | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSaved: () => Promise<void>;
}) {
  const t = useTranslations("travels");
  const tCommon = useTranslations("common");
  const [values, setValues] = useState<GrabFormValues>({
    title: item?.title ?? "",
    amount: item ? String(item.amount) : "1",
  });
  const [loadedItem, setLoadedItem] = useState(item);
  const [syncedOpen, setSyncedOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  if (open && !syncedOpen) {
    setSyncedOpen(true);
    setLoadedItem(item);
    setValues({
      title: item?.title ?? "",
      amount: item ? String(item.amount) : "1",
    });
  }
  if (!open && syncedOpen) {
    setSyncedOpen(false);
  }
  if (open && item !== loadedItem) {
    setLoadedItem(item);
    setValues({
      title: item?.title ?? "",
      amount: item ? String(item.amount) : "1",
    });
  }

  async function handleSave() {
    const title = values.title.trim();
    const amount = Number.parseInt(values.amount, 10);
    if (!title) {
      toast.error(t("grabTitleRequired"));
      return;
    }
    if (!Number.isInteger(amount) || amount < 1) {
      toast.error(t("grabAmountRequired"));
      return;
    }
    setSaving(true);
    const body = { title, amount };
    const now = new Date().toISOString();
    if (item) {
      upsertThingInCache(travelId, {
        ...item,
        ...body,
        updatedAt: now,
      });
      enqueueTravelOp({
        travelId,
        op: { kind: "updateThing", entityId: item.id, body },
      });
    } else {
      const entityLocalId = makeLocalEntityId();
      upsertThingInCache(travelId, {
        id: entityLocalId,
        travelId,
        title: body.title,
        amount: body.amount,
        isChecked: false,
        createdAt: now,
        updatedAt: now,
      });
      enqueueTravelOp({
        travelId,
        op: { kind: "createThing", entityLocalId, body },
      });
    }
    await onSaved();
    setSaving(false);
  }

  const parsedAmount = Number.parseInt(values.amount, 10);
  const canSave =
    Boolean(values.title.trim()) &&
    Number.isInteger(parsedAmount) &&
    parsedAmount >= 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent size="md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogHeaderInner>
            <DialogTitle>
              {item ? t("grabEditTitle") : t("grabAddTitle")}
            </DialogTitle>
          </ResponsiveDialogHeaderInner>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="travel-grab-title">{t("grabTitle")}</Label>
            <Input
              id="travel-grab-title"
              value={values.title}
              className="h-12 rounded-xl text-base md:h-11"
              placeholder={t("grabTitlePlaceholder")}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, title: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="travel-grab-amount">{t("grabAmount")}</Label>
            <Input
              id="travel-grab-amount"
              type="number"
              inputMode="numeric"
              min={1}
              max={9999}
              step={1}
              value={values.amount}
              className="h-12 rounded-xl text-base md:h-11"
              placeholder="1"
              onChange={(event) =>
                setValues((prev) => ({
                  ...prev,
                  amount: event.target.value.replace(/[^\d]/g, ""),
                }))
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
            className="h-11 rounded-xl"
            disabled={saving || !canSave}
            onClick={() => void handleSave()}
          >
            {tCommon("save")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
