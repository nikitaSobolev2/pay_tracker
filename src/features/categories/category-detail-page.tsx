"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CategoryPieChart } from "@/features/charts/category-pie-chart";
import { thisPeriodVsPreviousClassName } from "@/features/charts/money-cards/primitives";
import { MoneyValueCard } from "@/features/charts/money-summary-cards";
import { TimelineChart } from "@/features/charts/timeline-chart";
import { ConfirmCategoryDeleteDialog } from "@/features/categories/confirm-category-delete-dialog";
import {
  TransactionListAmount,
  TransactionListPrimary,
} from "@/features/transactions/transaction-list-primary";
import { Link, useRouter } from "@/i18n/navigation";
import {
  deleteCategory,
  listCategories,
  updateCategory,
} from "@/lib/api/categories";
import {
  fetchCategoryDetailStats,
  fetchTransactionStats,
} from "@/lib/api/stats";
import { listTransactions } from "@/lib/api/transactions";
import { decimalToString, formatChartMoney, toDecimal } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CategoryDetailStats } from "@/server/services/detail-stats-service.types";
import type {
  ListPageStats,
  MoneyAmount,
  PeriodComparison,
} from "@/server/services/stats-service.types";
import { useUiStore } from "@/stores/ui.store";
import { DateRangeType, TransactionType } from "@/types/enums";
import type {
  TransactionCategoryDto,
  TransactionDto,
} from "@/types/transaction";

export function CategoryDetailPage({ id }: { readonly id: string }) {
  const t = useTranslations("categories");
  const tCommon = useTranslations("common");
  const tHome = useTranslations("home");
  const tNav = useTranslations("nav");
  const router = useRouter();
  const openEditTransactionModal = useUiStore(
    (state) => state.openEditTransactionModal,
  );
  const [categories, setCategories] = useState<TransactionCategoryDto[]>([]);
  const [detailStats, setDetailStats] = useState<CategoryDetailStats | null>(
    null,
  );
  const [allTimeStats, setAllTimeStats] = useState<ListPageStats | null>(null);
  const [transactions, setTransactions] = useState<TransactionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [keywords, setKeywords] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const category = useMemo(
    () => categories.find((item) => item.id === id) ?? null,
    [categories, id],
  );
  const parent = useMemo(
    () =>
      category?.parentCategoryId
        ? categories.find((item) => item.id === category.parentCategoryId)
        : null,
    [categories, category],
  );
  const children = useMemo(
    () => categories.filter((item) => item.parentCategoryId === id),
    [categories, id],
  );
  const childrenPie = detailStats?.childrenPie ?? [];
  const showChildrenPie =
    children.length > 0 && (loading || childrenPie.length > 0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { categories: nextCategories } = await listCategories();
      setCategories(nextCategories);
      const found = nextCategories.find((item) => item.id === id);
      if (!found) {
        return;
      }
      setTitle(found.title);
      setKeywords(found.keywords.join(", "));
      const [detail, allTime, txList] = await Promise.all([
        fetchCategoryDetailStats(id),
        fetchTransactionStats({
          categoryIds: [id],
          dateRangeType: DateRangeType.AllTime,
        }),
        listTransactions({
          categoryIds: [id],
          dateRangeType: DateRangeType.AllTime,
          page: 1,
          pageSize: 40,
        }),
      ]);
      setDetailStats(detail.stats);
      setAllTimeStats(allTime);
      setTransactions(txList.items);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onChanged() {
      void load();
    }
    window.addEventListener("paytracker:transactions-changed", onChanged);
    return () =>
      window.removeEventListener(
        "paytracker:transactions-changed",
        onChanged,
      );
  }, [load]);

  async function save() {
    if (!category || !title.trim()) {
      return;
    }
    await updateCategory(category.id, {
      title: title.trim(),
      keywords: parseKeywords(keywords),
    });
    setEditing(false);
    await load();
    toast.success(t("updated"));
  }

  async function remove() {
    if (!category) {
      return;
    }
    setDeleting(true);
    try {
      await deleteCategory(category.id);
      setDeleteOpen(false);
      router.replace("/categories");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("deleteFailed"));
    } finally {
      setDeleting(false);
    }
  }

  if (!category && !loading) {
    return <p className="text-sm text-muted-foreground">{t("loadFailed")}</p>;
  }

  if (!category) {
    return null;
  }

  const currency =
    allTimeStats?.displayCurrency ?? detailStats?.currency ?? "RUB";
  const allTimeTotal =
    category.type === TransactionType.Earning
      ? allTimeStats?.periodTotals.earning
      : allTimeStats?.periodTotals.spending;
  const monthAmount =
    detailStats?.thisMonth ?? { amount: "0", currency };
  const monthComparison = monthPeriodComparison(
    detailStats?.thisMonth,
    detailStats?.lastMonth,
    currency,
  );
  const monthComparisonSense =
    category.type === TransactionType.Earning
      ? "higherIsBetter"
      : "lowerIsBetter";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="space-y-2">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              <Input
                value={keywords}
                placeholder={t("keywordsHint")}
                onChange={(event) => setKeywords(event.target.value)}
              />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-3xl font-semibold tracking-tight">
                  {category.title}
                </h1>
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-full px-2.5 text-xs font-medium",
                    category.type === TransactionType.Earning
                      ? "border-emerald-500/30 text-emerald-400"
                      : "border-rose-500/30 text-rose-400",
                  )}
                >
                  {category.type === TransactionType.Earning
                    ? tNav("earnings")
                    : tNav("spendings")}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {category.path}
              </p>
              {category.keywords.length > 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("keywords")}: {category.keywords.join(", ")}
                </p>
              ) : null}
            </>
          )}
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {editing ? (
            <Button className="h-11 w-full sm:h-9 sm:w-auto" onClick={() => void save()}>
              {tCommon("save")}
            </Button>
          ) : (
            <Button
              variant="outline"
              className="h-11 w-full sm:h-9 sm:w-auto"
              onClick={() => setEditing(true)}
            >
              <Pencil /> {tCommon("edit")}
            </Button>
          )}
          <Button
            variant="destructive"
            className="h-11 w-full sm:h-9 sm:w-auto"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 /> {tCommon("delete")}
          </Button>
        </div>
      </header>

      <div className="grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-xl border p-4">
          <p className="text-muted-foreground">{t("parentCategory")}</p>
          {parent ? (
            <Link href={`/categories/${parent.id}`}>{parent.title}</Link>
          ) : (
            <p>{t("noParent")}</p>
          )}
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-muted-foreground">{t("children")}</p>
          {children.length ? (
            children.map((child) => (
              <Link
                className="mr-3"
                key={child.id}
                href={`/categories/${child.id}`}
              >
                {child.title}
              </Link>
            ))
          ) : (
            <p>—</p>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <MoneyValueCard
          title={t("totalsAllTime")}
          loading={loading}
          amount={allTimeTotal ?? { amount: "0", currency }}
          amountClassName="text-foreground"
          hint={`${t("transactions")}: ${allTimeStats?.periodTotals.count ?? 0}`}
          disableShare
        />
        <MoneyValueCard
          title={t("totalsThisMonth")}
          loading={loading}
          amount={monthAmount}
          comparison={monthComparison}
          comparisonSense={monthComparisonSense}
          details={[
            {
              label: tHome("thisPeriod"),
              value: formatChartMoney(
                monthComparison.current.amount,
                monthComparison.current.currency,
              ),
              valueClassName: thisPeriodVsPreviousClassName(
                monthComparison,
                monthComparisonSense,
              ),
            },
            {
              label: tHome("previousPeriod"),
              value: monthComparison.previous
                ? formatChartMoney(
                    monthComparison.previous.amount,
                    monthComparison.previous.currency,
                  )
                : "—",
            },
          ]}
          disableShare
        />
      </div>

      <div
        className={cn("grid gap-3", showChildrenPie && "lg:grid-cols-2")}
      >
        {showChildrenPie ? (
          <CategoryPieChart
            title={t("childrenPie")}
            loading={loading}
            slices={childrenPie}
            currency={currency}
            disableShare
          />
        ) : null}
        <TimelineChart
          title={t("timeline")}
          loading={loading}
          points={detailStats?.timeline ?? allTimeStats?.timeline ?? []}
          currency={currency}
          mode={
            category.type === TransactionType.Earning ? "earning" : "spending"
          }
          disableShare
        />
      </div>

      <Card className="rounded-2xl border-border/60 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-xl">{t("transactions")}</CardTitle>
          <Link
            href={`/transactions?categoryIds=${id}&dateRangeType=${DateRangeType.AllTime}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            {t("viewTransactions")}
          </Link>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
          ) : transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("noTransactions")}
            </p>
          ) : (
            transactions.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-xl border border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => router.push(`/transactions/${item.id}`)}
                >
                  <TransactionListPrimary item={item} />
                </button>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <TransactionListAmount item={item} />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-10 shrink-0 sm:size-9"
                    onClick={() => openEditTransactionModal(item)}
                    aria-label={tCommon("edit")}
                  >
                    <Pencil className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <ConfirmCategoryDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={category.title}
        loading={deleting}
        onConfirm={() => void remove()}
      />
    </div>
  );
}

function monthPeriodComparison(
  thisMonth: MoneyAmount | null | undefined,
  lastMonth: MoneyAmount | null | undefined,
  currency: string,
): PeriodComparison {
  const current = thisMonth ?? { amount: "0", currency };
  if (!lastMonth) {
    return {
      current,
      previous: null,
      deltaAmount: null,
      deltaPercent: null,
    };
  }
  const currentAmount = toDecimal(current.amount);
  const previousAmount = toDecimal(lastMonth.amount);
  const delta = currentAmount.minus(previousAmount);
  return {
    current,
    previous: lastMonth,
    deltaAmount: decimalToString(delta),
    deltaPercent: previousAmount.eq(0)
      ? null
      : Number(delta.div(previousAmount).mul(100).toFixed(2)),
  };
}

function parseKeywords(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((keyword) => keyword.trim())
        .filter(Boolean),
    ),
  ];
}
