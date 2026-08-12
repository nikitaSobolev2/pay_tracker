"use client";

import {
  Check,
  ChevronDown,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ObjectCard, ObjectCardBody, ReceiptRail } from "@/components/ui/object-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { normalizeAmountRaw } from "@/lib/amount-input";
import { BENTO_LABEL_CLASS } from "@/lib/bento";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  createEventSpending,
  deleteEventSpending,
  updateEventSpending,
} from "@/lib/api/events";
import { EVENT_AMOUNT_UNITS } from "@/lib/event-units";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { EventSpendingDto } from "@/server/services/event-service.types";
import type { EventSpendingCategory } from "@/types/enums";

import { useEventContext } from "./event-context";
import {
  CATEGORY_ALT_SURFACE_CLASS,
  CATEGORY_HEADER_SURFACE_CLASS,
  CATEGORY_ICONS,
  CATEGORY_LABEL_KEYS,
  CATEGORY_ORDER,
  CATEGORY_SURFACE_CLASS,
} from "./event-spending-categories";
import {
  EventSpendingFormDialog,
  emptySpendingValues,
  type SpendingFormValues,
} from "./event-spending-form-dialog";
import { EventSpendingThreads } from "./event-spending-threads";

type SpendingGroup = {
  readonly category: EventSpendingCategory;
  readonly total: string;
  readonly spendings: readonly EventSpendingDto[];
};

type DraftSpending = {
  readonly key: string;
  readonly category: EventSpendingCategory;
  title: string;
  amount: string;
  amountUnit: string;
  price: string;
};

type InlineNumbers = {
  readonly amount: string;
  readonly amountUnit: string;
  readonly price: string;
};

const SAVE_DEBOUNCE_MS = 450;
const CELL_INPUT_CLASS =
  "h-8 w-full min-w-14 rounded-md border-border/50 bg-transparent px-1.5 text-right text-sm tabular-nums shadow-none";
/** Match SelectTrigger sm height on mobile (default sm is h-11). */
const MOBILE_CONTROL_HEIGHT_CLASS = "!h-9 data-[size=sm]:!h-9";
const MOBILE_INPUT_CLASS = cn(
  MOBILE_CONTROL_HEIGHT_CLASS,
  "w-full min-w-0 rounded-md border-border/60 bg-background/50 px-1.5 py-0 text-right text-xs tabular-nums shadow-none md:text-xs",
);
/** qty · unit · price (~2× amount) · spacer+total. */
const MOBILE_FIELDS_GRID_CLASS =
  "grid w-full grid-cols-[3.25rem_4.5rem_6.5rem_minmax(0,1fr)] items-end gap-1.5";
const MOBILE_SELECT_TRIGGER_CLASS = cn(
  MOBILE_CONTROL_HEIGHT_CLASS,
  "!w-full min-w-0 max-w-full justify-between gap-0.5 !rounded-md border-border/60 bg-background/50 px-1 py-0 text-xs shadow-none md:text-xs",
  "[&_svg:not([class*='size-'])]:size-3.5",
  "*:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:flex-1 *:data-[slot=select-value]:truncate",
);

export function EventSpendingsList({
  className,
}: {
  readonly className?: string;
}) {
  const t = useTranslations("events");
  const { event, viewer, refreshEvent } = useEventContext();
  const isMobile = useIsMobile();
  const [editing, setEditing] = useState<EventSpendingDto | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<DraftSpending[]>([]);

  const groups = useMemo(
    () => groupByCategory(event.spendings, event.summary.byCategory),
    [event.spendings, event.summary.byCategory],
  );

  const initialValues = useMemo<SpendingFormValues>(
    () => (editing ? toFormValues(editing) : emptySpendingValues()),
    [editing],
  );

  function startEdit(spending: EventSpendingDto) {
    setEditing(spending);
    setDialogOpen(true);
  }

  function startDraft(category: EventSpendingCategory) {
    setDrafts((current) => {
      if (current.some((draft) => draft.category === category)) {
        return current;
      }
      return [
        {
          key: `draft-${category}-${Date.now()}`,
          category,
          title: "",
          amount: "1",
          amountUnit: EVENT_AMOUNT_UNITS[0] ?? "шт",
          price: "",
        },
        ...current,
      ];
    });
  }

  function updateDraft(key: string, patch: Partial<DraftSpending>) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.key === key ? { ...draft, ...patch } : draft,
      ),
    );
  }

  function discardDraft(key: string) {
    setDrafts((current) => current.filter((draft) => draft.key !== key));
  }

  async function commitDraft(draft: DraftSpending) {
    const title = draft.title.trim();
    if (!title) {
      discardDraft(draft.key);
      return;
    }
    const amount = draft.amount.trim() || "1";
    const price = draft.price.trim() || "0";
    try {
      await createEventSpending(event.id, {
        title,
        category: draft.category,
        amount,
        amountUnit: draft.amountUnit,
        price,
        note: null,
      });
      discardDraft(draft.key);
      await refreshEvent();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("spendingFailed"));
    }
  }

  async function submit(values: SpendingFormValues) {
    setSaving(true);
    try {
      const payload = {
        title: values.title.trim(),
        category: values.category,
        amount: values.amount.trim(),
        amountUnit: values.amountUnit,
        price: values.price.trim(),
        note: values.note.trim() || null,
      };
      if (editing) {
        await updateEventSpending(event.id, editing.id, payload);
      } else {
        await createEventSpending(event.id, payload);
      }
      await refreshEvent();
      setDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("spendingFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function remove(spendingId: string) {
    try {
      await deleteEventSpending(event.id, spendingId);
      await refreshEvent();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("spendingFailed"));
    }
  }

  function handleDelete(spendingId: string) {
    void remove(spendingId);
  }

  const spendingsBody = isMobile ? (
    <MobileSpendingsList
      groups={groups}
      drafts={drafts}
      canEdit={viewer.canEdit}
      onEdit={startEdit}
      onDelete={handleDelete}
      onAdd={startDraft}
      onDraftChange={updateDraft}
      onDraftCommit={(draft) => void commitDraft(draft)}
      onDraftDiscard={discardDraft}
    />
  ) : (
    <DesktopSpendingsTable
      groups={groups}
      drafts={drafts}
      canEdit={viewer.canEdit}
      onEdit={startEdit}
      onDelete={handleDelete}
      onAdd={startDraft}
      onDraftChange={updateDraft}
      onDraftCommit={(draft) => void commitDraft(draft)}
      onDraftDiscard={discardDraft}
    />
  );

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className={BENTO_LABEL_CLASS}>{t("spendingsTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {spendingsBody}

        <div className="flex items-center justify-between border-t border-border/60 pt-3 text-sm">
          <span className="text-muted-foreground">{t("spendingsTotal")}</span>
          <span className="text-lg font-semibold tabular-nums">
            {formatMoney(event.summary.total, event.currency)}
          </span>
        </div>
      </CardContent>

      <EventSpendingFormDialog
        open={dialogOpen}
        initialValues={initialValues}
        saving={saving}
        onOpenChange={setDialogOpen}
        onSubmit={submit}
      />
    </Card>
  );
}

function DesktopSpendingsTable({
  groups,
  drafts,
  canEdit,
  onEdit,
  onDelete,
  onAdd,
  onDraftChange,
  onDraftCommit,
  onDraftDiscard,
}: {
  readonly groups: readonly SpendingGroup[];
  readonly drafts: readonly DraftSpending[];
  readonly canEdit: boolean;
  readonly onEdit: (spending: EventSpendingDto) => void;
  readonly onDelete: (spendingId: string) => void;
  readonly onAdd: (category: EventSpendingCategory) => void;
  readonly onDraftChange: (key: string, patch: Partial<DraftSpending>) => void;
  readonly onDraftCommit: (draft: DraftSpending) => void;
  readonly onDraftDiscard: (key: string) => void;
}) {
  const t = useTranslations("events");

  return (
    <Table className="min-w-xl table-fixed">
      <colgroup>
        <col className="w-auto" />
        <col className="w-20" />
        <col className="w-20" />
        <col className="w-28" />
        <col className="w-28" />
        <col className="w-28" />
      </colgroup>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="h-9 text-xs text-muted-foreground">
            {t("spendingTitleField")}
          </TableHead>
          <TableHead className="h-9 text-right text-xs text-muted-foreground">
            {t("spendingAmount")}
          </TableHead>
          <TableHead className="h-9 text-right text-xs text-muted-foreground">
            {t("spendingUnit")}
          </TableHead>
          <TableHead className="h-9 text-right text-xs text-muted-foreground">
            {t("spendingPrice")}
          </TableHead>
          <TableHead className="h-9 text-right text-xs text-muted-foreground">
            {t("spendingsTotal")}
          </TableHead>
          <TableHead className="h-9 w-28" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => (
          <SpendingGroupRows
            key={group.category}
            group={group}
            drafts={drafts.filter((draft) => draft.category === group.category)}
            canEdit={canEdit}
            onEdit={onEdit}
            onDelete={onDelete}
            onAdd={() => onAdd(group.category)}
            onDraftChange={onDraftChange}
            onDraftCommit={onDraftCommit}
            onDraftDiscard={onDraftDiscard}
          />
        ))}
      </TableBody>
    </Table>
  );
}

function MobileSpendingsList({
  groups,
  drafts,
  canEdit,
  onEdit,
  onDelete,
  onAdd,
  onDraftChange,
  onDraftCommit,
  onDraftDiscard,
}: {
  readonly groups: readonly SpendingGroup[];
  readonly drafts: readonly DraftSpending[];
  readonly canEdit: boolean;
  readonly onEdit: (spending: EventSpendingDto) => void;
  readonly onDelete: (spendingId: string) => void;
  readonly onAdd: (category: EventSpendingCategory) => void;
  readonly onDraftChange: (key: string, patch: Partial<DraftSpending>) => void;
  readonly onDraftCommit: (draft: DraftSpending) => void;
  readonly onDraftDiscard: (key: string) => void;
}) {
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <MobileSpendingGroup
          key={group.category}
          group={group}
          drafts={drafts.filter((draft) => draft.category === group.category)}
          canEdit={canEdit}
          onEdit={onEdit}
          onDelete={onDelete}
          onAdd={() => onAdd(group.category)}
          onDraftChange={onDraftChange}
          onDraftCommit={onDraftCommit}
          onDraftDiscard={onDraftDiscard}
        />
      ))}
    </div>
  );
}

function MobileSpendingGroup({
  group,
  drafts,
  canEdit,
  onEdit,
  onDelete,
  onAdd,
  onDraftChange,
  onDraftCommit,
  onDraftDiscard,
}: {
  readonly group: SpendingGroup;
  readonly drafts: readonly DraftSpending[];
  readonly canEdit: boolean;
  readonly onEdit: (spending: EventSpendingDto) => void;
  readonly onDelete: (spendingId: string) => void;
  readonly onAdd: () => void;
  readonly onDraftChange: (key: string, patch: Partial<DraftSpending>) => void;
  readonly onDraftCommit: (draft: DraftSpending) => void;
  readonly onDraftDiscard: (key: string) => void;
}) {
  const t = useTranslations("events");
  const { event } = useEventContext();
  const [expanded, setExpanded] = useState(true);
  const CategoryIcon = CATEGORY_ICONS[group.category];

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl",
        CATEGORY_SURFACE_CLASS[group.category],
      )}
    >
      <SpendingCategoryHeader
        category={group.category}
        categoryIcon={CategoryIcon}
        totalLabel={formatMoney(group.total, event.currency)}
        itemCount={group.spendings.length}
        expanded={expanded}
        className={cn(
          "px-3 py-2",
          CATEGORY_HEADER_SURFACE_CLASS[group.category],
        )}
        onToggle={() => setExpanded((current) => !current)}
      />

      {expanded ? (
        <div className="space-y-2 p-2">
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-full justify-center gap-1.5 border-border/70 bg-background/60 text-xs hover:bg-background/80"
              onClick={onAdd}
            >
              <Plus className="size-3.5" />
              {t("spendingAddUnderCategory")}
            </Button>
          ) : null}
          {drafts.map((draft) => (
            <ObjectCard key={draft.key} dashed>
              <ReceiptRail />
              <ObjectCardBody className="flex-col items-stretch p-0">
                <MobileDraftSpendingRow
                  draft={draft}
                  onChange={(patch) => onDraftChange(draft.key, patch)}
                  onCommit={() => onDraftCommit(draft)}
                  onDiscard={() => onDraftDiscard(draft.key)}
                />
              </ObjectCardBody>
            </ObjectCard>
          ))}
          {group.spendings.map((spending) => (
            <ObjectCard key={spending.id} dashed>
              <ReceiptRail />
              <ObjectCardBody className="flex-col items-stretch p-0">
                <MobileSpendingRow
                  spending={spending}
                  canEdit={canEdit}
                  onEdit={() => onEdit(spending)}
                  onDelete={() => onDelete(spending.id)}
                />
              </ObjectCardBody>
            </ObjectCard>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function MobileSpendingRow({
  spending,
  canEdit,
  onEdit,
  onDelete,
}: {
  readonly spending: EventSpendingDto;
  readonly canEdit: boolean;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}) {
  const t = useTranslations("events");
  const { event, threadCounts } = useEventContext();
  const {
    amount,
    amountUnit,
    price,
    setAmount,
    setAmountUnit,
    setPrice,
    liveTotal,
  } = useInlineSpendingNumbers(spending);

  const unitItems = useMemo(
    () =>
      uniqueUnits(spending.amountUnit).map((unit) => ({
        value: unit,
        label: unit,
      })),
    [spending.amountUnit],
  );

  return (
    <div className="space-y-2 px-3 py-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-0.5">
          {canEdit ? (
            <button
              type="button"
              className="w-full text-left"
              onClick={onEdit}
            >
              <p className="truncate text-[15px] font-medium leading-snug">
                {spending.title}
              </p>
            </button>
          ) : (
            <p className="truncate text-[15px] font-medium leading-snug">
              {spending.title}
            </p>
          )}
          <p className="truncate text-xs leading-snug text-muted-foreground">
            {spending.author.name}
            {spending.note ? ` · ${spending.note}` : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <EventSpendingThreads
            spendingId={spending.id}
            openCount={
              threadCounts[spending.id] ?? spending.openThreadCount ?? 0
            }
          />
          {canEdit ? (
            <SpendingRowMenu onEdit={onEdit} onDelete={onDelete} />
          ) : null}
        </div>
      </div>

      {canEdit ? (
        <div className={MOBILE_FIELDS_GRID_CLASS}>
          <MobileInlineField label={t("spendingAmount")}>
            <Input
              inputMode="decimal"
              aria-label={t("spendingAmount")}
              className={MOBILE_INPUT_CLASS}
              value={amount}
              onChange={(changeEvent) =>
                setAmount(sanitizeDecimal(changeEvent.target.value))
              }
            />
          </MobileInlineField>
          <MobileInlineField label={t("spendingUnit")}>
            <Select
              value={amountUnit}
              items={unitItems}
              onValueChange={(next) => {
                if (next) {
                  setAmountUnit(next);
                }
              }}
            >
              <SelectTrigger
                size="sm"
                aria-label={t("spendingUnit")}
                className={MOBILE_SELECT_TRIGGER_CLASS}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {unitItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </MobileInlineField>
          <MobileInlineField label={t("spendingPriceShort")}>
            <AmountInput
              aria-label={t("spendingPrice")}
              className={MOBILE_INPUT_CLASS}
              value={price}
              onValueChange={setPrice}
            />
          </MobileInlineField>
          <MobileInlineField
            label={t("spendingsTotal")}
            className="min-w-0 justify-self-end text-right"
          >
            <p
              className="flex h-9 items-center justify-end whitespace-nowrap text-sm font-bold tabular-nums"
              aria-label={t("spendingsTotal")}
            >
              {formatMoney(liveTotal, event.currency)}
            </p>
          </MobileInlineField>
        </div>
      ) : (
        <p className="text-xs tabular-nums text-muted-foreground">
          {spending.amount} {spending.amountUnit}
          {" · "}
          {formatMoney(spending.price, event.currency)}
          {" → "}
          <span className="font-semibold text-foreground">
            {formatMoney(liveTotal, event.currency)}
          </span>
        </p>
      )}
    </div>
  );
}

function MobileInlineField({
  label,
  className,
  children,
}: {
  readonly label: string;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0 overflow-hidden space-y-0.5", className)}>
      <span className="block truncate text-[9px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

function SpendingGroupRows({
  group,
  drafts,
  canEdit,
  onEdit,
  onDelete,
  onAdd,
  onDraftChange,
  onDraftCommit,
  onDraftDiscard,
}: {
  readonly group: SpendingGroup;
  readonly drafts: readonly DraftSpending[];
  readonly canEdit: boolean;
  readonly onEdit: (spending: EventSpendingDto) => void;
  readonly onDelete: (spendingId: string) => void;
  readonly onAdd: () => void;
  readonly onDraftChange: (key: string, patch: Partial<DraftSpending>) => void;
  readonly onDraftCommit: (draft: DraftSpending) => void;
  readonly onDraftDiscard: (key: string) => void;
}) {
  const t = useTranslations("events");
  const { event } = useEventContext();
  const [expanded, setExpanded] = useState(true);
  const CategoryIcon = CATEGORY_ICONS[group.category];

  const surfaceClass = CATEGORY_SURFACE_CLASS[group.category];
  const headerClass = CATEGORY_HEADER_SURFACE_CLASS[group.category];

  return (
    <>
      <TableRow className="border-b-0 hover:bg-transparent">
        <TableCell colSpan={6} className={cn("p-0", headerClass)}>
          <SpendingCategoryHeader
            category={group.category}
            categoryIcon={CategoryIcon}
            totalLabel={formatMoney(group.total, event.currency)}
            itemCount={group.spendings.length}
            expanded={expanded}
            className="px-2 py-1.5"
            onToggle={() => setExpanded((current) => !current)}
          />
        </TableCell>
      </TableRow>

      {expanded ? (
        <>
          {canEdit ? (
            <TableRow className="border-b-0 hover:bg-transparent">
              <TableCell colSpan={6} className={cn("py-1", surfaceClass)}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 w-full justify-center gap-1.5 border-border/70 bg-background/60 text-xs hover:bg-background/80"
                  onClick={onAdd}
                >
                  <Plus className="size-3.5" />
                  {t("spendingAddUnderCategory")}
                </Button>
              </TableCell>
            </TableRow>
          ) : null}
          {drafts.map((draft) => (
            <DesktopDraftSpendingRow
              key={draft.key}
              draft={draft}
              surfaceClass={surfaceClass}
              onChange={(patch) => onDraftChange(draft.key, patch)}
              onCommit={() => onDraftCommit(draft)}
              onDiscard={() => onDraftDiscard(draft.key)}
            />
          ))}
          {group.spendings.map((spending, index) => (
            <SpendingRow
              key={spending.id}
              spending={spending}
              canEdit={canEdit}
              surfaceClass={
                index % 2 === 1
                  ? CATEGORY_ALT_SURFACE_CLASS[group.category]
                  : surfaceClass
              }
              onEdit={() => onEdit(spending)}
              onDelete={() => onDelete(spending.id)}
            />
          ))}
        </>
      ) : null}
    </>
  );
}

function DesktopDraftSpendingRow({
  draft,
  surfaceClass,
  onChange,
  onCommit,
  onDiscard,
}: {
  readonly draft: DraftSpending;
  readonly surfaceClass: string;
  readonly onChange: (patch: Partial<DraftSpending>) => void;
  readonly onCommit: () => void;
  readonly onDiscard: () => void;
}) {
  const t = useTranslations("events");
  const { event } = useEventContext();
  const liveTotal = computeTotal(draft.amount, draft.price);
  const unitItems = useMemo(
    () =>
      uniqueUnits(draft.amountUnit).map((unit) => ({
        value: unit,
        label: unit,
      })),
    [draft.amountUnit],
  );

  return (
    <TableRow className={cn(surfaceClass, "border-b-0")}>
      <TableCell className="max-w-0 whitespace-normal py-2">
        <Input
          value={draft.title}
          placeholder={t("spendingTitleField")}
          className="h-8 border-border/50 bg-transparent px-1.5 text-sm font-medium shadow-none"
          autoFocus
          onChange={(changeEvent) =>
            onChange({ title: changeEvent.target.value })
          }
          onKeyDown={(keyEvent) => {
            if (keyEvent.key === "Enter") {
              keyEvent.preventDefault();
              onCommit();
            }
            if (keyEvent.key === "Escape") {
              onDiscard();
            }
          }}
        />
      </TableCell>
      <TableCell className="py-1.5">
        <Input
          inputMode="decimal"
          aria-label={t("spendingAmount")}
          className={CELL_INPUT_CLASS}
          value={draft.amount}
          onChange={(changeEvent) =>
            onChange({ amount: sanitizeDecimal(changeEvent.target.value) })
          }
        />
      </TableCell>
      <TableCell className="py-1.5">
        <Select
          value={draft.amountUnit}
          items={unitItems}
          onValueChange={(next) => {
            if (next) {
              onChange({ amountUnit: next });
            }
          }}
        >
          <SelectTrigger
            size="sm"
            aria-label={t("spendingUnit")}
            className="h-8 w-full rounded-md border-border/50 bg-transparent px-1.5 text-sm shadow-none"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {unitItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="py-1.5">
        <AmountInput
          aria-label={t("spendingPrice")}
          className={CELL_INPUT_CLASS}
          value={draft.price}
          onValueChange={(value) => onChange({ price: value })}
        />
      </TableCell>
      <TableCell className="py-2 text-right font-semibold tabular-nums">
        {liveTotal
          ? formatMoney(liveTotal, event.currency)
          : formatMoney("0", event.currency)}
      </TableCell>
      <TableCell className="py-1.5">
        <div className="flex items-center justify-end gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t("spendingDraftSave")}
            onClick={onCommit}
          >
            <Check className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-destructive"
            aria-label={t("spendingDraftDiscard")}
            onClick={onDiscard}
          >
            <X className="size-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function MobileDraftSpendingRow({
  draft,
  onChange,
  onCommit,
  onDiscard,
}: {
  readonly draft: DraftSpending;
  readonly onChange: (patch: Partial<DraftSpending>) => void;
  readonly onCommit: () => void;
  readonly onDiscard: () => void;
}) {
  const t = useTranslations("events");
  const { event } = useEventContext();
  const liveTotal = computeTotal(draft.amount, draft.price);
  const unitItems = useMemo(
    () =>
      uniqueUnits(draft.amountUnit).map((unit) => ({
        value: unit,
        label: unit,
      })),
    [draft.amountUnit],
  );

  return (
    <div className="space-y-2 px-3 py-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Input
            value={draft.title}
            placeholder={t("spendingTitleField")}
            className={cn(
              MOBILE_CONTROL_HEIGHT_CLASS,
              "w-full border-border/60 bg-background/50 px-1.5 text-[15px] font-medium shadow-none md:text-sm",
            )}
            autoFocus
            onChange={(changeEvent) =>
              onChange({ title: changeEvent.target.value })
            }
            onKeyDown={(keyEvent) => {
              if (keyEvent.key === "Enter") {
                keyEvent.preventDefault();
                onCommit();
              }
              if (keyEvent.key === "Escape") {
                onDiscard();
              }
            }}
          />
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t("spendingDraftSave")}
            onClick={onCommit}
          >
            <Check className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-destructive"
            aria-label={t("spendingDraftDiscard")}
            onClick={onDiscard}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div className={MOBILE_FIELDS_GRID_CLASS}>
        <MobileInlineField label={t("spendingAmount")}>
          <Input
            inputMode="decimal"
            aria-label={t("spendingAmount")}
            className={MOBILE_INPUT_CLASS}
            value={draft.amount}
            onChange={(changeEvent) =>
              onChange({ amount: sanitizeDecimal(changeEvent.target.value) })
            }
          />
        </MobileInlineField>
        <MobileInlineField label={t("spendingUnit")}>
          <Select
            value={draft.amountUnit}
            items={unitItems}
            onValueChange={(next) => {
              if (next) {
                onChange({ amountUnit: next });
              }
            }}
          >
            <SelectTrigger
              size="sm"
              aria-label={t("spendingUnit")}
              className={MOBILE_SELECT_TRIGGER_CLASS}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {unitItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </MobileInlineField>
        <MobileInlineField label={t("spendingPriceShort")}>
          <AmountInput
            aria-label={t("spendingPrice")}
            className={MOBILE_INPUT_CLASS}
            value={draft.price}
            onValueChange={(value) => onChange({ price: value })}
          />
        </MobileInlineField>
        <MobileInlineField
          label={t("spendingsTotal")}
          className="min-w-0 justify-self-end text-right"
        >
          <p
            className="flex h-9 items-center justify-end whitespace-nowrap text-sm font-bold tabular-nums"
            aria-label={t("spendingsTotal")}
          >
            {formatMoney(liveTotal ?? "0", event.currency)}
          </p>
        </MobileInlineField>
      </div>
    </div>
  );
}

function SpendingCategoryHeader({
  category,
  categoryIcon: CategoryIcon,
  totalLabel,
  itemCount,
  expanded,
  className,
  onToggle,
}: {
  readonly category: EventSpendingCategory;
  readonly categoryIcon: LucideIcon;
  readonly totalLabel: string;
  readonly itemCount: number;
  readonly expanded: boolean;
  readonly className?: string;
  readonly onToggle: () => void;
}) {
  const t = useTranslations("events");
  const categoryLabel = t(CATEGORY_LABEL_KEYS[category]);

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 text-left text-xs font-medium tracking-wide text-foreground/80 uppercase transition-colors hover:bg-foreground/5",
        className,
      )}
      aria-expanded={expanded}
      aria-label={
        expanded
          ? t("spendingCategoryCollapse", { category: categoryLabel })
          : t("spendingCategoryExpand", { category: categoryLabel })
      }
      onClick={onToggle}
    >
      <ChevronDown
        className={cn(
          "size-3.5 shrink-0 text-foreground/60 transition-transform",
          !expanded && "-rotate-90",
        )}
      />
      <CategoryIcon className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{categoryLabel}</span>
      {!expanded ? (
        <span className="shrink-0 tabular-nums text-muted-foreground normal-case">
          {itemCount}
        </span>
      ) : null}
      <span className="shrink-0 tabular-nums normal-case">{totalLabel}</span>
    </button>
  );
}

function SpendingRow({
  spending,
  canEdit,
  surfaceClass,
  onEdit,
  onDelete,
}: {
  readonly spending: EventSpendingDto;
  readonly canEdit: boolean;
  readonly surfaceClass: string;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}) {
  const t = useTranslations("events");
  const { event, threadCounts } = useEventContext();
  const {
    amount,
    amountUnit,
    price,
    setAmount,
    setAmountUnit,
    setPrice,
    liveTotal,
  } = useInlineSpendingNumbers(spending);

  const unitItems = useMemo(
    () =>
      uniqueUnits(spending.amountUnit).map((unit) => ({
        value: unit,
        label: unit,
      })),
    [spending.amountUnit],
  );

  return (
    <TableRow className={cn(surfaceClass, "hover:brightness-[0.98] dark:hover:brightness-110")}>
      <TableCell className="max-w-0 whitespace-normal py-2">
        <p className="truncate font-medium leading-snug">{spending.title}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {spending.author.name}
          {spending.note ? ` · ${spending.note}` : null}
        </p>
      </TableCell>

      <TableCell className="py-1.5">
        {canEdit ? (
          <Input
            inputMode="decimal"
            aria-label={t("spendingAmount")}
            className={CELL_INPUT_CLASS}
            value={amount}
            onChange={(changeEvent) =>
              setAmount(sanitizeDecimal(changeEvent.target.value))
            }
          />
        ) : (
          <span className="block text-right tabular-nums">{spending.amount}</span>
        )}
      </TableCell>

      <TableCell className="py-1.5">
        {canEdit ? (
          <Select
            value={amountUnit}
            items={unitItems}
            onValueChange={(next) => {
              if (next) {
                setAmountUnit(next);
              }
            }}
          >
            <SelectTrigger
              size="sm"
              aria-label={t("spendingUnit")}
              className="h-8 w-full rounded-md border-border/50 bg-transparent px-1.5 text-sm shadow-none"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {unitItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="block text-right">{spending.amountUnit}</span>
        )}
      </TableCell>

      <TableCell className="py-1.5">
        {canEdit ? (
          <AmountInput
            aria-label={t("spendingPrice")}
            className={CELL_INPUT_CLASS}
            value={price}
            onValueChange={setPrice}
          />
        ) : (
          <span className="block text-right tabular-nums">
            {formatMoney(spending.price, event.currency)}
          </span>
        )}
      </TableCell>

      <TableCell className="py-2 text-right font-semibold tabular-nums">
        {formatMoney(liveTotal, event.currency)}
      </TableCell>

      <TableCell className="py-1.5">
        <div className="flex items-center justify-end gap-0.5">
          <EventSpendingThreads
            spendingId={spending.id}
            openCount={
              threadCounts[spending.id] ?? spending.openThreadCount ?? 0
            }
          />
          {canEdit ? (
            <SpendingRowButtons onEdit={onEdit} onDelete={onDelete} />
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

/** Keeps qty/unit/price local, patches the server after a short idle period. */
function useInlineSpendingNumbers(spending: EventSpendingDto) {
  const t = useTranslations("events");
  const { event, refreshEvent } = useEventContext();
  const [amount, setAmount] = useState(spending.amount);
  const [amountUnit, setAmountUnit] = useState(spending.amountUnit);
  const [price, setPrice] = useState(() => normalizeAmountRaw(spending.price));
  const savedRef = useRef<InlineNumbers>({
    amount: spending.amount,
    amountUnit: spending.amountUnit,
    price: normalizeAmountRaw(spending.price),
  });
  const dirtyRef = useRef(false);
  const draftRef = useRef<InlineNumbers>({
    amount: spending.amount,
    amountUnit: spending.amountUnit,
    price: normalizeAmountRaw(spending.price),
  });

  draftRef.current = { amount, amountUnit, price };

  useEffect(() => {
    if (dirtyRef.current) {
      return;
    }
    const next = {
      amount: spending.amount,
      amountUnit: spending.amountUnit,
      price: normalizeAmountRaw(spending.price),
    };
    if (isSameNumbers(next, savedRef.current)) {
      return;
    }
    setAmount(next.amount);
    setAmountUnit(next.amountUnit);
    setPrice(next.price);
    savedRef.current = next;
  }, [spending.id, spending.amount, spending.amountUnit, spending.price]);

  const draft = useMemo(
    () => ({ amount, amountUnit, price }),
    [amount, amountUnit, price],
  );
  const debounced = useDebouncedValue(draft, SAVE_DEBOUNCE_MS);

  useEffect(() => {
    if (isSameNumbers(debounced, savedRef.current)) {
      return;
    }
    if (!isPositiveNumber(debounced.amount) || !isPositiveNumber(debounced.price)) {
      return;
    }
    if (!debounced.amountUnit.trim()) {
      return;
    }

    let cancelled = false;
    void updateEventSpending(event.id, spending.id, {
      amount: debounced.amount.trim(),
      amountUnit: debounced.amountUnit.trim(),
      price: debounced.price.trim(),
    })
      .then(async () => {
        if (cancelled) {
          return;
        }
        savedRef.current = debounced;
        if (isSameNumbers(draftRef.current, debounced)) {
          dirtyRef.current = false;
        }
        await refreshEvent();
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : t("spendingFailed"),
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debounced, event.id, refreshEvent, spending.id, t]);

  const liveTotal = computeTotal(amount, price) ?? spending.total;

  return {
    amount,
    amountUnit,
    price,
    setAmount: (value: string) => {
      dirtyRef.current = true;
      setAmount(value);
    },
    setAmountUnit: (value: string) => {
      dirtyRef.current = true;
      setAmountUnit(value);
    },
    setPrice: (value: string) => {
      dirtyRef.current = true;
      setPrice(value);
    },
    liveTotal,
  };
}

function SpendingRowButtons({
  onEdit,
  onDelete,
}: {
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}) {
  const tCommon = useTranslations("common");

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 rounded-lg"
        aria-label={tCommon("edit")}
        onClick={onEdit}
      >
        <Pencil className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 rounded-lg text-destructive"
        aria-label={tCommon("delete")}
        onClick={onDelete}
      >
        <Trash2 className="size-4" />
      </Button>
    </>
  );
}

function SpendingRowMenu({
  onEdit,
  onDelete,
}: {
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}) {
  const tCommon = useTranslations("common");
  const tHeader = useTranslations("header");
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 rounded-lg"
            aria-label={tHeader("menu")}
          />
        }
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44 p-1.5">
        <DropdownMenuItem
          className="min-h-12 gap-2.5 px-3 text-base"
          onClick={() => {
            setOpen(false);
            onEdit();
          }}
        >
          <Pencil className="size-4" />
          {tCommon("edit")}
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          className="min-h-12 gap-2.5 px-3 text-base"
          onClick={() => {
            setOpen(false);
            onDelete();
          }}
        >
          <Trash2 className="size-4" />
          {tCommon("delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function groupByCategory(
  spendings: readonly EventSpendingDto[],
  totals: readonly { category: EventSpendingCategory; total: string }[],
): SpendingGroup[] {
  const totalByCategory = new Map(
    totals.map((entry) => [entry.category, entry.total]),
  );
  return CATEGORY_ORDER.map((category) => ({
    category,
    total: totalByCategory.get(category) ?? "0",
    spendings: spendings.filter((spending) => spending.category === category),
  }));
}

function toFormValues(spending: EventSpendingDto): SpendingFormValues {
  return {
    title: spending.title,
    category: spending.category,
    amount: spending.amount,
    amountUnit: spending.amountUnit,
    price: spending.price,
    note: spending.note ?? "",
  };
}

function uniqueUnits(current: string): string[] {
  const units: string[] = [...EVENT_AMOUNT_UNITS];
  if (current && !units.includes(current)) {
    units.unshift(current);
  }
  return units;
}

function isSameNumbers(left: InlineNumbers, right: InlineNumbers): boolean {
  return (
    left.amount === right.amount &&
    left.amountUnit === right.amountUnit &&
    left.price === right.price
  );
}

function isPositiveNumber(value: string): boolean {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function sanitizeDecimal(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [whole = "", ...rest] = cleaned.split(".");
  if (rest.length === 0) {
    return whole;
  }
  return `${whole}.${rest.join("").slice(0, 4)}`;
}

function computeTotal(amount: string, price: string): string | null {
  if (!isPositiveNumber(amount) || !isPositiveNumber(price)) {
    return null;
  }
  return (Number(amount) * Number(price)).toFixed(2);
}
