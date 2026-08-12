"use client";

import { Backpack, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  SwipeableList,
  SwipeableListItem,
  SwipeAction,
  TrailingActions,
  Type as SwipeType,
} from "react-swipeable-list";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import {
  LuggageQtyRail,
  ObjectCard,
  ObjectCardBody,
  ObjectCardCopy,
} from "@/components/ui/object-card";
import {
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogHeaderInner,
} from "@/components/ui/responsive-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { enqueueTravelOp } from "@/lib/offline/travel-offline-sync";
import type { TravelThingToGrabDto } from "@/server/services/travel-service.types";
import {
  makeLocalEntityId,
  removeThingFromCache,
  upsertThingInCache,
} from "@/stores/travel-cache.store";

import {
  TravelSectionEmpty,
  TravelSectionHeader,
} from "./travel-section-card";

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
        <TravelSectionHeader
          title={t("thingsToGrab")}
          count={
            items.length > 0
              ? `${items.filter((item) => item.isChecked).length}/${items.length}`
              : undefined
          }
          action={
            <Button type="button" variant="outline" onClick={openCreate}>
              <Plus className="size-4" />
              {t("grabAdd")}
            </Button>
          }
        />
        <CardContent className="space-y-3 p-3 pt-3 sm:p-4">
          {items.length === 0 ? (
            <TravelSectionEmpty icon={Backpack} text={t("grabsEmpty")} />
          ) : (
            <SwipeableList
              type={SwipeType.IOS}
              fullSwipe={false}
              threshold={0.45}
              className="object-swipe-list"
            >
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
            </SwipeableList>
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

type SwipeableListInjectedProps = {
  readonly fullSwipe?: boolean;
  readonly listType?: SwipeType;
  readonly threshold?: number;
  readonly actionDelay?: number;
  readonly destructiveCallbackDelay?: number;
  readonly optOutMouseEvents?: boolean;
  readonly scrollStartThreshold?: number;
  readonly swipeStartThreshold?: number;
  readonly clickedCallback?: (id: string) => void;
  readonly id?: string;
  readonly resetState?: (close: () => void) => void;
};

function GrabRow({
  item,
  toggling,
  onToggle,
  onEdit,
  onDelete,
  ...swipeProps
}: {
  readonly item: TravelThingToGrabDto;
  readonly toggling: boolean;
  readonly onToggle: () => void;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
} & SwipeableListInjectedProps) {
  const t = useTranslations("travels");
  const tCommon = useTranslations("common");
  const isMobile = useIsMobile();

  return (
    <SwipeableListItem
      {...swipeProps}
      blockSwipe={!isMobile}
      trailingActions={
        <TrailingActions>
          <SwipeAction onClick={onEdit}>
            <div className="object-swipe-action bg-muted text-foreground">
              <Pencil className="size-4" />
              <span>{tCommon("edit")}</span>
            </div>
          </SwipeAction>
          <SwipeAction onClick={onDelete}>
            <div className="object-swipe-action bg-destructive text-destructive-foreground">
              <Trash2 className="size-4" />
              <span>{tCommon("delete")}</span>
            </div>
          </SwipeAction>
        </TrailingActions>
      }
    >
      <ObjectCard faded={item.isChecked}>
        <LuggageQtyRail quantity={item.amount} />
        <ObjectCardBody>
          <Checkbox
            className="size-5"
            checked={item.isChecked}
            disabled={toggling}
            onCheckedChange={onToggle}
            aria-label={t("grabToggleChecked")}
          />
          <ObjectCardCopy title={item.title} struck={item.isChecked} />
          <div className="hidden shrink-0 items-center gap-0.5 md:flex">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 rounded-xl"
              aria-label={tCommon("edit")}
              onClick={onEdit}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 rounded-xl text-destructive"
              aria-label={t("grabDelete")}
              onClick={onDelete}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </ObjectCardBody>
      </ObjectCard>
    </SwipeableListItem>
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
        baseline: {
          title: item.title,
          amount: item.amount,
        },
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
        <ResponsiveDialogBody>
          <FormField
            label={t("grabTitle")}
            htmlFor="travel-grab-title"
            required
          >
            <Input
              id="travel-grab-title"
              value={values.title}
              placeholder={t("grabTitlePlaceholder")}
              required
              onChange={(event) =>
                setValues((prev) => ({ ...prev, title: event.target.value }))
              }
            />
          </FormField>
          <FormField
            label={t("grabAmount")}
            htmlFor="travel-grab-amount"
            required
          >
            <Input
              id="travel-grab-amount"
              type="number"
              inputMode="numeric"
              min={1}
              max={9999}
              step={1}
              value={values.amount}
              placeholder="1"
              required
              onChange={(event) =>
                setValues((prev) => ({
                  ...prev,
                  amount: event.target.value.replace(/[^\d]/g, ""),
                }))
              }
            />
          </FormField>
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
