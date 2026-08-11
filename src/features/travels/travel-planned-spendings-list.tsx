"use client";

import {
  Check,
  ChevronDown,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import {
  Card,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useIsMobile } from "@/hooks/use-mobile";
import { enqueueTravelOp } from "@/lib/offline/travel-offline-sync";
import { formatChartMoney, toIntegerAmountString } from "@/lib/money";
import { cn } from "@/lib/utils";
import type {
  TravelCategoryBudgetDto,
  TravelPlannedSpendingDto,
} from "@/server/services/travel-service.types";
import {
  makeLocalEntityId,
  removePlannedFromCache,
  upsertCategoryBudgetInCache,
  upsertPlannedInCache,
} from "@/stores/travel-cache.store";
import { TravelPlannedCategory } from "@/types/enums";

import {
  CATEGORY_ICONS,
  CATEGORY_LABEL_KEYS,
  CATEGORY_ORDER,
  CATEGORY_SURFACE_CLASS,
} from "./travel-planned-categories";

type TravelPlannedSpendingsListProps = {
  readonly travelId: string;
  readonly currency: string;
  readonly items: readonly TravelPlannedSpendingDto[];
  readonly categoryBudgets: readonly TravelCategoryBudgetDto[];
  readonly onChanged: () => Promise<void>;
};

type DraftRow = {
  readonly key: string;
  readonly category: TravelPlannedCategory;
  title: string;
  amount: string;
};

export function TravelPlannedSpendingsList({
  travelId,
  currency,
  items,
  categoryBudgets,
  onChanged,
}: TravelPlannedSpendingsListProps) {
  const t = useTranslations("travels");
  const isMobile = useIsMobile();
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<TravelPlannedSpendingDto | null>(null);

  const budgetByCategory = useMemo(() => {
    return new Map(
      categoryBudgets.map((budget) => [budget.category, budget.amount]),
    );
  }, [categoryBudgets]);

  const groups = useMemo(() => {
    return CATEGORY_ORDER.map((category) => {
      const spendings = items.filter((item) => item.category === category);
      const budget = budgetByCategory.get(category) ?? null;
      const childrenTotal = spendings.reduce(
        (sum, item) => sum + Number(item.amount),
        0,
      );
      return {
        category,
        spendings,
        budget,
        locked: budget != null,
        total: budget ?? String(childrenTotal),
      };
    });
  }, [budgetByCategory, items]);

  async function commitDraft(draft: DraftRow) {
    if (!draft.title.trim() || !draft.amount.trim()) {
      return;
    }
    const body = {
      title: draft.title.trim(),
      category: draft.category,
      amount: draft.amount,
    };
    const entityLocalId = makeLocalEntityId();
    const now = new Date().toISOString();
    upsertPlannedInCache(travelId, {
      id: entityLocalId,
      travelId,
      title: body.title,
      category: body.category,
      amount: body.amount,
      note: null,
      createdAt: now,
      updatedAt: now,
    });
    enqueueTravelOp({
      travelId,
      op: { kind: "createPlanned", entityLocalId, body },
    });
    setDrafts((prev) => prev.filter((row) => row.key !== draft.key));
    await onChanged();
  }

  async function removeSpending(spendingId: string) {
    removePlannedFromCache(travelId, spendingId);
    enqueueTravelOp({
      travelId,
      op: { kind: "deletePlanned", entityId: spendingId },
    });
    await onChanged();
  }

  async function commitAmount(item: TravelPlannedSpendingDto, amount: string) {
    upsertPlannedInCache(travelId, {
      ...item,
      amount,
      updatedAt: new Date().toISOString(),
    });
    enqueueTravelOp({
      travelId,
      op: {
        kind: "updatePlanned",
        entityId: item.id,
        body: { amount },
      },
    });
    await onChanged();
  }

  return (
    <Card className="border-border/60 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{t("spendings")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {groups.map((group) => {
          const Icon = CATEGORY_ICONS[group.category];
          const isCollapsed = group.locked
            ? true
            : (collapsed[group.category] ?? false);
          const categoryDrafts = drafts.filter(
            (draft) => draft.category === group.category,
          );
          return (
            <div
              key={group.category}
              className="overflow-hidden rounded-2xl border border-border/50"
            >
              <div
                className={cn(
                  "flex min-h-12 flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3",
                  CATEGORY_SURFACE_CLASS[group.category],
                )}
              >
                <button
                  type="button"
                  className="flex min-h-11 flex-1 items-center gap-3 text-left"
                  disabled={group.locked}
                  onClick={() =>
                    setCollapsed((prev) => ({
                      ...prev,
                      [group.category]: !isCollapsed,
                    }))
                  }
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="flex-1 font-medium">
                    {t(CATEGORY_LABEL_KEYS[group.category])}
                  </span>
                  {group.locked ? null : (
                    <ChevronDown
                      className={cn(
                        "size-4 transition-transform",
                        isCollapsed && "-rotate-90",
                      )}
                    />
                  )}
                </button>
                <CategoryBudgetField
                  currency={currency}
                  value={group.budget}
                  displayTotal={group.total}
                  locked={group.locked}
                  onSave={async (amount) => {
                    upsertCategoryBudgetInCache(
                      travelId,
                      group.category,
                      amount,
                    );
                    enqueueTravelOp({
                      travelId,
                      op: {
                        kind: "upsertCategoryBudget",
                        category: group.category,
                        amount,
                      },
                    });
                    if (amount != null && amount !== "") {
                      setDrafts((prev) =>
                        prev.filter(
                          (draft) => draft.category !== group.category,
                        ),
                      );
                    }
                    await onChanged();
                  }}
                />
              </div>

              {group.locked ? (
                <p className="px-3 py-2.5 text-sm text-muted-foreground">
                  {t("categoryTotalLocked")}
                </p>
              ) : isCollapsed ? null : (
                <div className="space-y-2 p-2 sm:p-3">
                  {isMobile ? (
                    <div className="space-y-2">
                      {group.spendings.map((item) => (
                        <MobileSpendingCard
                          key={item.id}
                          item={item}
                          onEdit={() => setEditing(item)}
                          onDelete={() => void removeSpending(item.id)}
                          onAmountCommit={async (amount) => {
                            await commitAmount(item, amount);
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("spendingTitle")}</TableHead>
                          <TableHead className="w-36">{t("spendingAmount")}</TableHead>
                          <TableHead className="w-24" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.spendings.map((item) => (
                          <DesktopSpendingRow
                            key={item.id}
                            item={item}
                            onEdit={() => setEditing(item)}
                            onDelete={() => void removeSpending(item.id)}
                            onAmountCommit={async (amount) => {
                              await commitAmount(item, amount);
                            }}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  {categoryDrafts.map((draft) => (
                    <DraftRowEditor
                      key={draft.key}
                      draft={draft}
                      onChange={(next) =>
                        setDrafts((prev) =>
                          prev.map((row) =>
                            row.key === draft.key ? next : row,
                          ),
                        )
                      }
                      onCommit={() => void commitDraft(draft)}
                      onDiscard={() =>
                        setDrafts((prev) =>
                          prev.filter((row) => row.key !== draft.key),
                        )
                      }
                    />
                  ))}

                  {group.spendings.length === 0 && categoryDrafts.length === 0 ? (
                    <p className="px-1 py-2 text-sm text-muted-foreground">
                      {t("spendingEmptyCategory")}
                    </p>
                  ) : null}

                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 w-full justify-start gap-2 rounded-xl"
                    onClick={() =>
                      setDrafts((prev) => [
                        ...prev,
                        {
                          key: `${group.category}-${Date.now()}`,
                          category: group.category,
                          title: "",
                          amount: "",
                        },
                      ])
                    }
                  >
                    <Plus className="size-4" />
                    {t("addSpending")}
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        <PlannedSpendingEditDialog
          open={editing != null}
          item={editing}
          onOpenChange={(open) => {
            if (!open) {
              setEditing(null);
            }
          }}
          onSave={async (values) => {
            if (!editing) {
              return;
            }
            upsertPlannedInCache(travelId, {
              ...editing,
              ...values,
              note: values.note ?? null,
              updatedAt: new Date().toISOString(),
            });
            enqueueTravelOp({
              travelId,
              op: {
                kind: "updatePlanned",
                entityId: editing.id,
                body: values,
              },
            });
            setEditing(null);
            await onChanged();
          }}
        />
      </CardContent>
    </Card>
  );
}

function CategoryBudgetField({
  currency,
  value,
  displayTotal,
  locked,
  onSave,
}: {
  readonly currency: string;
  readonly value: string | null;
  readonly displayTotal: string;
  readonly locked: boolean;
  readonly onSave: (amount: string | null) => Promise<void>;
}) {
  const t = useTranslations("travels");
  const integerValue =
    value == null || value === "" ? "" : toIntegerAmountString(value);
  const [draft, setDraft] = useState(integerValue);
  const [synced, setSynced] = useState(integerValue);
  const debounced = useDebouncedValue(draft, 500);

  if (integerValue !== synced) {
    setSynced(integerValue);
    setDraft(integerValue);
  }

  useEffect(() => {
    // Empty clears only via Clear button (null). "0" is a valid locked total.
    if (debounced === integerValue || debounced.trim() === "") {
      return;
    }
    void onSave(debounced);
  }, [debounced, integerValue, onSave]);

  return (
    <div
      className="flex w-full items-center gap-2 sm:w-auto sm:min-w-[14rem]"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className="min-w-0 flex-1">
        <AmountInput
          integerOnly
          value={draft}
          placeholder={t("categoryTotal")}
          aria-label={t("categoryTotal")}
          title={t("categoryTotalHint")}
          className="h-11 rounded-xl bg-background/80"
          onValueChange={setDraft}
        />
      </div>
      {locked ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-11 shrink-0 rounded-xl px-2"
          onClick={() => {
            setDraft("");
            void onSave(null);
          }}
        >
          {t("categoryTotalClear")}
        </Button>
      ) : (
        <span className="hidden shrink-0 text-sm tabular-nums sm:inline">
          {formatChartMoney(displayTotal, currency)}
        </span>
      )}
    </div>
  );
}

function DesktopSpendingRow({
  item,
  onEdit,
  onDelete,
  onAmountCommit,
}: {
  readonly item: TravelPlannedSpendingDto;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
  readonly onAmountCommit: (amount: string) => Promise<void>;
}) {
  return (
    <TableRow>
      <TableCell>
        <button
          type="button"
          className="min-h-10 text-left font-medium hover:underline"
          onClick={onEdit}
        >
          {item.title}
        </button>
      </TableCell>
      <TableCell>
        <InlineAmount value={item.amount} onCommit={onAmountCommit} />
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 rounded-lg"
            onClick={onEdit}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 rounded-lg text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function MobileSpendingCard({
  item,
  onEdit,
  onDelete,
  onAmountCommit,
}: {
  readonly item: TravelPlannedSpendingDto;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
  readonly onAmountCommit: (amount: string) => Promise<void>;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/60 p-3">
      <button
        type="button"
        className="mb-2 min-h-11 w-full text-left text-base font-medium"
        onClick={onEdit}
      >
        {item.title}
      </button>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <InlineAmount value={item.amount} onCommit={onAmountCommit} />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 rounded-xl text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function InlineAmount({
  value,
  onCommit,
}: {
  readonly value: string;
  readonly onCommit: (amount: string) => Promise<void>;
}) {
  const t = useTranslations("travels");
  const integerValue = toIntegerAmountString(value);
  const [draft, setDraft] = useState(integerValue);
  const [syncedValue, setSyncedValue] = useState(integerValue);
  const debounced = useDebouncedValue(draft, 450);

  if (integerValue !== syncedValue) {
    setSyncedValue(integerValue);
    setDraft(integerValue);
  }

  useEffect(() => {
    if (debounced === integerValue || !debounced.trim()) {
      return;
    }
    void onCommit(debounced).catch((error: unknown) => {
      toast.error(
        error instanceof Error ? error.message : t("spendingSaveFailed"),
      );
      setDraft(integerValue);
    });
  }, [debounced, integerValue, onCommit, t]);

  return (
    <AmountInput
      integerOnly
      value={draft}
      className="h-11 rounded-xl"
      onValueChange={setDraft}
    />
  );
}

function DraftRowEditor({
  draft,
  onChange,
  onCommit,
  onDiscard,
}: {
  readonly draft: DraftRow;
  readonly onChange: (draft: DraftRow) => void;
  readonly onCommit: () => void;
  readonly onDiscard: () => void;
}) {
  const t = useTranslations("travels");
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border/70 p-2 sm:flex-row sm:items-center">
      <Input
        value={draft.title}
        placeholder={t("spendingTitle")}
        className="h-11 flex-1 rounded-xl"
        onChange={(event) =>
          onChange({ ...draft, title: event.target.value })
        }
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            onCommit();
          }
          if (event.key === "Escape") {
            onDiscard();
          }
        }}
      />
      <AmountInput
        integerOnly
        value={draft.amount}
        className="h-11 w-full rounded-xl sm:w-36"
        onValueChange={(amount) => onChange({ ...draft, amount })}
      />
      <div className="flex gap-1">
        <Button
          type="button"
          size="icon"
          className="size-11 rounded-xl"
          onClick={onCommit}
        >
          <Check className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 rounded-xl"
          onClick={onDiscard}
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function PlannedSpendingEditDialog({
  open,
  item,
  onOpenChange,
  onSave,
}: {
  readonly open: boolean;
  readonly item: TravelPlannedSpendingDto | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSave: (values: {
    title: string;
    category: TravelPlannedCategory;
    amount: string;
    note: string | null;
  }) => Promise<void>;
}) {
  const t = useTranslations("travels");
  const tCommon = useTranslations("common");
  const [title, setTitle] = useState(item?.title ?? "");
  const [amount, setAmount] = useState(
    item?.amount ? toIntegerAmountString(item.amount) : "",
  );
  const [note, setNote] = useState(item?.note ?? "");
  const [loadedItem, setLoadedItem] = useState(item);
  const [saving, setSaving] = useState(false);

  if (item && item !== loadedItem) {
    setLoadedItem(item);
    setTitle(item.title);
    setAmount(toIntegerAmountString(item.amount));
    setNote(item.note ?? "");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent size="md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogHeaderInner>
            <DialogTitle>{t("edit")}</DialogTitle>
          </ResponsiveDialogHeaderInner>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody className="space-y-4">
          <div className="space-y-2">
            <Label>{t("spendingTitle")}</Label>
            <Input
              value={title}
              className="h-12 rounded-xl text-base md:h-11"
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("spendingAmount")}</Label>
            <AmountInput
              integerOnly
              value={amount}
              className="h-12 rounded-xl md:h-11"
              onValueChange={setAmount}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("spendingNote")}</Label>
            <Textarea
              value={note}
              className="min-h-24 rounded-xl"
              onChange={(event) => setNote(event.target.value)}
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
            disabled={saving || !item || !title.trim() || !amount.trim()}
            onClick={() => {
              if (!item) {
                return;
              }
              setSaving(true);
              void onSave({
                title: title.trim(),
                category: item.category,
                amount,
                note: note.trim() || null,
              })
                .catch((error: unknown) => {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : t("spendingSaveFailed"),
                  );
                })
                .finally(() => setSaving(false));
            }}
          >
            {tCommon("save")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
