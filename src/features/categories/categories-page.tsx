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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TransactionTypeSwitcher,
  type TransactionTypeFilter,
} from "@/features/transactions/transaction-type-switcher";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "@/lib/api/categories";
import { fetchTransactionStats } from "@/lib/api/stats";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useMobilePageChromeStore } from "@/stores/mobile-page-chrome.store";
import { DateRangeType, TransactionType } from "@/types/enums";
import type { TransactionCategoryDto } from "@/types/transaction";

import { ConfirmCategoryDeleteDialog } from "./confirm-category-delete-dialog";

const NO_PARENT_VALUE = "__none__";

type DialogMode = "create" | "edit";

type CategoryActivityInfo = {
  readonly amount: string;
  readonly percent: number;
  readonly currency: string;
};

export function CategoriesPage() {
  const t = useTranslations("categories");
  const tCommon = useTranslations("common");
  const tNav = useTranslations("nav");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filterId = searchParams.get("id");
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>("all");
  const [categories, setCategories] = useState<TransactionCategoryDto[]>([]);
  const [activityById, setActivityById] = useState<
    Map<string, CategoryActivityInfo>
  >(() => new Map());
  const [loading, setLoading] = useState(true);
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftType, setDraftType] = useState<TransactionType>(
    TransactionType.Spending,
  );
  const [draftParentId, setDraftParentId] = useState<string | null>(null);
  const [draftKeywords, setDraftKeywords] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<TransactionCategoryDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const pageType =
    typeFilter === "all" ? undefined : (typeFilter as TransactionType);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listResult, stats] = await Promise.all([
        listCategories(pageType),
        fetchTransactionStats({
          dateRangeType: DateRangeType.AllTime,
          type: pageType,
        }),
      ]);
      setCategories(listResult.categories);
      setActivityById(
        buildCategoryActivityMap(stats.categoryActivity, stats.displayCurrency),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [pageType, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    closeDialog();
  }, [typeFilter]);

  const editingCategory = useMemo(
    () => categories.find((category) => category.id === editingId) ?? null,
    [categories, editingId],
  );

  const dialogType =
    dialogMode === "edit" && editingCategory
      ? editingCategory.type
      : draftType;

  const parentOptions = useMemo(() => {
    return categories.filter((category) => {
      if (category.type !== dialogType) {
        return false;
      }
      if (dialogMode === "edit" && editingCategory) {
        return (
          category.id !== editingCategory.id &&
          !category.path.startsWith(`${editingCategory.path}/`)
        );
      }
      return true;
    });
  }, [categories, dialogMode, dialogType, editingCategory]);

  const parentSelectItems = useMemo(
    () => [
      { value: NO_PARENT_VALUE, label: t("noParent") },
      ...parentOptions.map((category) => ({
        value: category.id,
        label: category.path,
      })),
    ],
    [parentOptions, t],
  );

  const typeSelectItems = useMemo(
    () => [
      { value: TransactionType.Spending, label: tNav("spendings") },
      { value: TransactionType.Earning, label: tNav("earnings") },
    ],
    [tNav],
  );

  const visibleCategories = useMemo(() => {
    if (!filterId) {
      return [...categories].sort((left, right) => {
        if (typeFilter === "all") {
          return left.title.localeCompare(right.title);
        }
        return (
          Number(activityById.get(right.id)?.amount ?? 0) -
          Number(activityById.get(left.id)?.amount ?? 0)
        );
      });
    }
    return categories.filter((category) => category.id === filterId);
  }, [categories, filterId]);

  function closeDialog() {
    setDialogMode(null);
    setEditingId(null);
    setDraftTitle("");
    setDraftParentId(null);
    setDraftKeywords("");
    setDraftType(
      typeFilter === TransactionType.Earning
        ? TransactionType.Earning
        : TransactionType.Spending,
    );
  }

  function startCreate() {
    setDialogMode("create");
    setEditingId(null);
    setDraftTitle("");
    setDraftParentId(null);
    setDraftKeywords("");
    setDraftType(
      typeFilter === TransactionType.Earning
        ? TransactionType.Earning
        : TransactionType.Spending,
    );
  }

  const setMobilePageChrome = useMobilePageChromeStore((state) => state.setChrome);

  useEffect(() => {
    setMobilePageChrome({
      typeFilter: {
        value: typeFilter,
        onChange: setTypeFilter,
      },
      action: {
        kind: "add",
        onClick: startCreate,
        label: t("addCategory"),
      },
    });
    return () => setMobilePageChrome(null);
  }, [setMobilePageChrome, t, typeFilter]);

  function startEdit(category: TransactionCategoryDto) {
    setDialogMode("edit");
    setEditingId(category.id);
    setDraftTitle(category.title);
    setDraftType(category.type);
    setDraftParentId(category.parentCategoryId);
    setDraftKeywords(category.keywords.join(", "));
  }

  async function saveDialog() {
    const title = draftTitle.trim();
    if (!title) {
      toast.error(t("titleRequired"));
      return;
    }
    setSaving(true);
    try {
      if (dialogMode === "create") {
        await createCategory(
          title,
          draftType,
          draftParentId,
          parseKeywords(draftKeywords),
        );
        const refreshed = await listCategories(pageType);
        setCategories(refreshed.categories);
        closeDialog();
        toast.success(t("created"));
        return;
      }
      if (!editingCategory) {
        return;
      }
      await updateCategory(editingCategory.id, {
        title,
        parentCategoryId: draftParentId,
        keywords: parseKeywords(draftKeywords),
      });
      const refreshed = await listCategories(pageType);
      setCategories(refreshed.categories);
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
      await deleteCategory(deleteTarget.id);
      setCategories((current) =>
        current.filter((item) => item.id !== deleteTarget.id),
      );
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
          className="h-11 shrink-0 gap-1.5 rounded-xl max-md:hidden"
          onClick={startCreate}
        >
          <Plus className="size-4" />
          {t("addCategory")}
        </Button>
      </header>

      <TransactionTypeSwitcher
        value={typeFilter}
        onChange={setTypeFilter}
        className="w-full max-md:hidden"
      />

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
        <CategoriesListContent
          loading={loading}
          categories={visibleCategories}
          activityById={activityById}
          typeFilter={typeFilter}
          emptyLabel={t("empty")}
          addLabel={t("addCategory")}
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
                  ? t("addCategoryTitle")
                  : t("editCategory")}
              </DialogTitle>
            </ResponsiveDialogHeaderInner>
            <div className="pb-3" />
          </ResponsiveDialogHeader>

          <ResponsiveDialogBody className="space-y-4">
            <div className="space-y-2">
              <Label>{t("titleField")}</Label>
              <Input
                className="h-12 rounded-xl text-base md:h-11"
                value={draftTitle}
                autoFocus
                onChange={(event) => setDraftTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void saveDialog();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("keywords")}</Label>
              <Input
                className="h-12 rounded-xl text-base md:h-11"
                value={draftKeywords}
                placeholder={t("keywordsHint")}
                onChange={(event) => setDraftKeywords(event.target.value)}
              />
            </div>
            {dialogMode === "create" ? (
              <div className="space-y-2">
                <Label>{t("typeField")}</Label>
                <Select
                  value={draftType}
                  items={typeSelectItems}
                  onValueChange={(value) => {
                    if (
                      value === TransactionType.Spending ||
                      value === TransactionType.Earning
                    ) {
                      setDraftType(value);
                      setDraftParentId(null);
                    }
                  }}
                >
                  <SelectTrigger className="h-12 w-full rounded-xl data-[size=default]:h-12 md:h-11 md:data-[size=default]:h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {typeSelectItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>{t("parentCategory")}</Label>
              <Select
                value={draftParentId ?? NO_PARENT_VALUE}
                items={parentSelectItems}
                onValueChange={(value) => {
                  if (typeof value !== "string" || value === NO_PARENT_VALUE) {
                    setDraftParentId(null);
                    return;
                  }
                  setDraftParentId(value);
                }}
              >
                <SelectTrigger className="h-12 w-full rounded-xl data-[size=default]:h-12 md:h-11 md:data-[size=default]:h-11">
                  <SelectValue placeholder={t("noParent")} />
                </SelectTrigger>
                <SelectContent>
                  {parentSelectItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              disabled={saving || !draftTitle.trim()}
              onClick={() => void saveDialog()}
            >
              {saving ? <Loader2 className="animate-spin" /> : null}
              {tCommon("save")}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </Dialog>

      <ConfirmCategoryDeleteDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget?.path ?? deleteTarget?.title ?? ""}
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

function buildCategoryActivityMap(
  activities: Array<{
    readonly categoryId: string;
    readonly amount: string;
    readonly percent: number;
  }>,
  currency: string,
): Map<string, CategoryActivityInfo> {
  const map = new Map<string, CategoryActivityInfo>();
  for (const activity of activities) {
    map.set(activity.categoryId, {
      amount: activity.amount,
      percent: activity.percent,
      currency,
    });
  }
  return map;
}

function CategoriesListContent({
  loading,
  categories,
  activityById,
  typeFilter,
  emptyLabel,
  addLabel,
  onStartCreate,
  onStartEdit,
  onDelete,
}: {
  readonly loading: boolean;
  readonly categories: TransactionCategoryDto[];
  readonly activityById: Map<string, CategoryActivityInfo>;
  readonly typeFilter: TransactionTypeFilter;
  readonly emptyLabel: string;
  readonly addLabel: string;
  readonly onStartCreate: () => void;
  readonly onStartEdit: (category: TransactionCategoryDto) => void;
  readonly onDelete: (category: TransactionCategoryDto) => void;
}) {
  const t = useTranslations("categories");
  const tNav = useTranslations("nav");
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

  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        <Button
          type="button"
          variant="outline"
          className="h-10 gap-1.5 rounded-xl max-md:hidden"
          onClick={onStartCreate}
        >
          <Plus className="size-4" />
          {addLabel}
        </Button>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border/50">
      {categories.map((category) => {
        const activity = activityById.get(category.id) ?? null;
        const transactionsHref = `/transactions?type=${encodeURIComponent(category.type)}&categoryIds=${encodeURIComponent(category.id)}&dateRangeType=all_time`;
        return (
          <li
            key={category.id}
            className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Link
                  href={`/categories/${encodeURIComponent(category.id)}`}
                  className="truncate text-base font-medium underline-offset-4 hover:underline"
                >
                  {category.path}
                </Link>
                {typeFilter === "all" ? (
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
                ) : null}
              </div>

              {activity ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <Link
                    href={transactionsHref}
                    className={cn(
                      "font-semibold tabular-nums underline-offset-4 hover:underline",
                      category.type === TransactionType.Earning
                        ? "text-emerald-400"
                        : "text-rose-400",
                    )}
                  >
                    {formatMoney(activity.amount, activity.currency)}
                  </Link>
                  <span className="text-muted-foreground">
                    {t("share")}{" "}
                    <span className="tabular-nums text-foreground/80">
                      {activity.percent.toFixed(1)}%
                    </span>
                  </span>
                  <Link
                    href={transactionsHref}
                    className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {t("viewTransactions")}
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("noActivity")}</p>
              )}
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full gap-2 rounded-xl px-3 sm:h-10 sm:w-auto sm:shrink-0"
                aria-label={tCommon("edit")}
                onClick={() => onStartEdit(category)}
              >
                <Pencil className="size-4" />
                {tCommon("edit")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="h-11 w-full gap-2 rounded-xl px-3 sm:h-10 sm:w-auto sm:shrink-0"
                aria-label={tCommon("delete")}
                onClick={() => onDelete(category)}
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

function parseKeywords(value: string): string[] {
  return [...new Set(value.split(",").map((keyword) => keyword.trim()).filter(Boolean))];
}
