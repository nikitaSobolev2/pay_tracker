"use client";

import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageTitleWithBack } from "@/components/layout/page-back-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createCounterparty,
  deleteCounterparty,
  listCounterparties,
  updateCounterparty,
  type CounterpartyDto,
} from "@/lib/api/counterparties";
import { fetchDebtsStats } from "@/lib/api/stats";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { DebtCounterpartyStats } from "@/server/services/stats-service.types";
import { useMobilePageChromeStore } from "@/stores/mobile-page-chrome.store";

import { ConfirmCounterpartyDeleteDialog } from "./confirm-counterparty-delete-dialog";

type DialogMode = "create" | "edit";
type DebtTone = "owe" | "owed";
type DebtFilter = "all" | DebtTone;

type CounterpartyDebtInfo = {
  readonly tone: DebtTone;
  readonly stats: DebtCounterpartyStats;
};

export function CounterpartiesPage() {
  const t = useTranslations("counterparties");
  const tCommon = useTranslations("common");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filterId = searchParams.get("id");
  const [counterparties, setCounterparties] = useState<CounterpartyDto[]>([]);
  const [debtById, setDebtById] = useState<Map<string, CounterpartyDebtInfo>>(
    () => new Map(),
  );
  const [debtFilter, setDebtFilter] = useState<DebtFilter>("all");
  const [loading, setLoading] = useState(true);
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CounterpartyDto | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listResult, debtsStats] = await Promise.all([
        listCounterparties({ all: true }),
        fetchDebtsStats(),
      ]);
      setCounterparties(listResult.counterparties);
      setDebtById(buildDebtInfoMap(debtsStats));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const editingCounterparty =
    counterparties.find((item) => item.id === editingId) ?? null;

  const visibleCounterparties = useMemo(() => {
    let items = counterparties;
    if (filterId) {
      items = items.filter((item) => item.id === filterId);
    }
    if (debtFilter === "all") {
      return items;
    }
    return items.filter((item) => debtById.get(item.id)?.tone === debtFilter);
  }, [counterparties, debtById, debtFilter, filterId]);

  function closeDialog() {
    setDialogMode(null);
    setEditingId(null);
    setDraftName("");
  }

  function startCreate() {
    setDialogMode("create");
    setEditingId(null);
    setDraftName("");
  }

  const setMobilePageChrome = useMobilePageChromeStore((state) => state.setChrome);

  useEffect(() => {
    setMobilePageChrome({
      segmentFilter: {
        value: debtFilter,
        options: [
          { value: "all", label: t("filterAll") },
          { value: "owed", label: t("filterOwesMe") },
          { value: "owe", label: t("filterIOwe") },
        ],
        onChange: (next) => {
          if (next === "all" || next === "owe" || next === "owed") {
            setDebtFilter(next);
          }
        },
      },
      action: {
        kind: "add",
        onClick: startCreate,
        label: t("addCounterparty"),
      },
    });
    return () => setMobilePageChrome(null);
  }, [debtFilter, setMobilePageChrome, t]);

  function startEdit(counterparty: CounterpartyDto) {
    setDialogMode("edit");
    setEditingId(counterparty.id);
    setDraftName(counterparty.name);
  }

  async function saveDialog() {
    const name = draftName.trim();
    if (!name) {
      toast.error(t("nameRequired"));
      return;
    }
    setSaving(true);
    try {
      if (dialogMode === "create") {
        const result = await createCounterparty(name);
        setCounterparties((current) =>
          [...current, result.counterparty].sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        );
        closeDialog();
        toast.success(t("created"));
        return;
      }
      if (!editingCounterparty) {
        return;
      }
      const result = await updateCounterparty(editingCounterparty.id, name);
      setCounterparties((current) =>
        current.map((item) =>
          item.id === editingCounterparty.id ? result.counterparty : item,
        ),
      );
      closeDialog();
      toast.success(t("updated"));
    } catch (error) {
      const fallback =
        dialogMode === "create" ? t("createFailed") : t("updateFailed");
      toast.error(error instanceof Error ? error.message : fallback);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }
    setDeleting(true);
    try {
      await deleteCounterparty(deleteTarget.id);
      setCounterparties((current) =>
        current.filter((item) => item.id !== deleteTarget.id),
      );
      setDebtById((current) => {
        const next = new Map(current);
        next.delete(deleteTarget.id);
        return next;
      });
      if (editingId === deleteTarget.id) {
        closeDialog();
      }
      setDeleteTarget(null);
      toast.success(t("deleted"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("deleteFailed"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 pb-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <PageTitleWithBack fallbackHref="/">
          <h1 className="text-3xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            {t("subtitle")}
          </p>
        </PageTitleWithBack>
        <Button
          type="button"
          className="hidden h-11 shrink-0 gap-1.5 rounded-xl md:inline-flex"
          onClick={startCreate}
        >
          <Plus className="size-4" />
          {t("addCounterparty")}
        </Button>
      </header>

      <Tabs
        value={debtFilter}
        onValueChange={(next) => {
          if (next === "all" || next === "owe" || next === "owed") {
            setDebtFilter(next);
          }
        }}
        className="hidden w-full md:block"
      >
        <TabsList className="h-12 w-full rounded-xl p-1 md:w-full md:h-12">
          <TabsTrigger value="all" className="rounded-lg px-3 text-sm">
            {t("filterAll")}
          </TabsTrigger>
          <TabsTrigger value="owed" className="rounded-lg px-3 text-sm">
            {t("filterOwesMe")}
          </TabsTrigger>
          <TabsTrigger value="owe" className="rounded-lg px-3 text-sm">
            {t("filterIOwe")}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {filterId ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">{t("showingFiltered")}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 rounded-lg"
            onClick={() => router.replace(pathname)}
          >
            <X className="size-3.5" />
            {t("showAll")}
          </Button>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
        <CounterpartiesListContent
          loading={loading}
          counterparties={visibleCounterparties}
          debtById={debtById}
          debtFilter={debtFilter}
          emptyLabel={t("empty")}
          emptyFilteredLabel={t("emptyFiltered")}
          addLabel={t("addCounterparty")}
          onStartCreate={startCreate}
          onStartEdit={startEdit}
          onDelete={setDeleteTarget}
        />
      </section>

      <Dialog
        open={dialogMode !== null}
        onOpenChange={(open) => {
          if (!open && !saving) {
            closeDialog();
          }
        }}
      >
        <ResponsiveDialogContent size="md" showCloseButton>
          <ResponsiveDialogHeader>
            <ResponsiveDialogHeaderInner>
              <DialogTitle className="text-xl font-semibold tracking-tight">
                {dialogMode === "create"
                  ? t("addCounterpartyTitle")
                  : t("editCounterparty")}
              </DialogTitle>
            </ResponsiveDialogHeaderInner>
            <div className="pb-3" />
          </ResponsiveDialogHeader>

          <ResponsiveDialogBody className="space-y-4">
            <div className="space-y-2">
              <Label>{t("nameField")}</Label>
              <Input
                className="h-12 rounded-xl text-base md:h-11"
                value={draftName}
                autoFocus
                onChange={(event) => setDraftName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void saveDialog();
                  }
                }}
              />
            </div>
          </ResponsiveDialogBody>

          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full rounded-xl text-base sm:w-auto md:h-10"
              disabled={saving}
              onClick={closeDialog}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              className="h-12 w-full rounded-xl text-base sm:w-auto md:h-10"
              disabled={saving || !draftName.trim()}
              onClick={() => void saveDialog()}
            >
              {saving ? <Loader2 className="animate-spin" /> : null}
              {tCommon("save")}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </Dialog>

      <ConfirmCounterpartyDeleteDialog
        open={Boolean(deleteTarget)}
        name={deleteTarget?.name ?? ""}
        loading={deleting}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

function buildDebtInfoMap(stats: {
  myDebts: { counterparties: DebtCounterpartyStats[] };
  debtsToMe: { counterparties: DebtCounterpartyStats[] };
}): Map<string, CounterpartyDebtInfo> {
  const map = new Map<string, CounterpartyDebtInfo>();
  for (const person of stats.myDebts.counterparties) {
    map.set(person.counterpartyId, { tone: "owe", stats: person });
  }
  for (const person of stats.debtsToMe.counterparties) {
    map.set(person.counterpartyId, { tone: "owed", stats: person });
  }
  return map;
}

function CounterpartiesListContent({
  loading,
  counterparties,
  debtById,
  debtFilter,
  emptyLabel,
  emptyFilteredLabel,
  addLabel,
  onStartCreate,
  onStartEdit,
  onDelete,
}: {
  readonly loading: boolean;
  readonly counterparties: CounterpartyDto[];
  readonly debtById: Map<string, CounterpartyDebtInfo>;
  readonly debtFilter: DebtFilter;
  readonly emptyLabel: string;
  readonly emptyFilteredLabel: string;
  readonly addLabel: string;
  readonly onStartCreate: () => void;
  readonly onStartEdit: (counterparty: CounterpartyDto) => void;
  readonly onDelete: (counterparty: CounterpartyDto) => void;
}) {
  const t = useTranslations("counterparties");
  const tCommon = useTranslations("common");

  if (loading) {
    return (
      <div className="space-y-0 divide-y divide-border/50">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
            <Skeleton className="h-11 w-full sm:h-9 sm:w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (counterparties.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          {debtFilter === "all" ? emptyLabel : emptyFilteredLabel}
        </p>
        {debtFilter === "all" ? (
          <Button
            type="button"
            variant="outline"
            className="hidden h-10 gap-1.5 rounded-xl md:inline-flex"
            onClick={onStartCreate}
          >
            <Plus className="size-4" />
            {addLabel}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border/50">
      {counterparties.map((counterparty) => {
        const debt = debtById.get(counterparty.id) ?? null;
        return (
          <li
            key={counterparty.id}
            className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Link
                  href={`/counterparties/${encodeURIComponent(counterparty.id)}`}
                  className="truncate text-base font-medium underline-offset-4 hover:underline"
                >
                  {counterparty.name}
                </Link>
                {debt ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-full px-2.5 text-xs font-medium",
                      debt.tone === "owed"
                        ? "border-emerald-500/30 text-emerald-400"
                        : "border-rose-500/30 text-rose-400",
                    )}
                  >
                    {debt.tone === "owed" ? t("filterOwesMe") : t("filterIOwe")}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="rounded-full px-2.5 text-xs font-medium text-muted-foreground"
                  >
                    {t("noOpenDebt")}
                  </Badge>
                )}
              </div>

              {debt ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <Link
                    href={`/debts/${counterparty.id}`}
                    className={cn(
                      "font-semibold tabular-nums underline-offset-4 hover:underline",
                      debt.tone === "owed"
                        ? "text-emerald-400"
                        : "text-rose-400",
                    )}
                  >
                    {formatMoney(
                      debt.stats.totalAllTime.amount,
                      debt.stats.totalAllTime.currency,
                    )}
                  </Link>
                  <span className="text-muted-foreground">
                    {t("thisMonth")}{" "}
                    <span className="tabular-nums text-foreground/80">
                      {formatMoney(
                        debt.stats.totalThisMonth.amount,
                        debt.stats.totalThisMonth.currency,
                      )}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    {t("events")}{" "}
                    <span className="tabular-nums text-foreground/80">
                      {debt.stats.eventCount}
                    </span>
                  </span>
                  <Link
                    href={`/debts/${counterparty.id}`}
                    className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {t("viewDebt")}
                  </Link>
                </div>
              ) : null}
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full gap-2 rounded-xl px-3 sm:h-10 sm:w-auto sm:shrink-0"
                aria-label={tCommon("edit")}
                onClick={() => onStartEdit(counterparty)}
              >
                <Pencil className="size-4" />
                {tCommon("edit")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="h-11 w-full gap-2 rounded-xl px-3 sm:h-10 sm:w-auto sm:shrink-0"
                aria-label={tCommon("delete")}
                onClick={() => onDelete(counterparty)}
              >
                <Trash2 className="size-4" />
                {tCommon("delete")}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
