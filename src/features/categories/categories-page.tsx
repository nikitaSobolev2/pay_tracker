"use client";

import { Loader2, Pencil, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  deleteCategory,
  listCategories,
  updateCategory,
} from "@/lib/api/categories";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { TransactionType } from "@/types/enums";
import type { TransactionCategoryDto } from "@/types/transaction";

import { ConfirmCategoryDeleteDialog } from "./confirm-category-delete-dialog";

const NO_PARENT_VALUE = "__none__";

export function CategoriesPage() {
  const t = useTranslations("categories");
  const tCommon = useTranslations("common");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filterId = searchParams.get("id");
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>("all");
  const [categories, setCategories] = useState<TransactionCategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftParentId, setDraftParentId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<TransactionCategoryDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const pageType =
    typeFilter === "all" ? undefined : (typeFilter as TransactionType);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listCategories(pageType);
      setCategories(result.categories);
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
    setEditingId(null);
    setDraftTitle("");
    setDraftParentId(null);
  }, [typeFilter]);

  const editingCategory = useMemo(
    () => categories.find((category) => category.id === editingId) ?? null,
    [categories, editingId],
  );

  const parentOptions = useMemo(() => {
    if (!editingCategory) {
      return [];
    }
    return categories.filter(
      (category) =>
        category.id !== editingCategory.id &&
        category.type === editingCategory.type &&
        !category.path.startsWith(`${editingCategory.path}/`),
    );
  }, [categories, editingCategory]);

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

  const visibleCategories = useMemo(() => {
    if (!filterId) {
      return categories;
    }
    return categories.filter((category) => category.id === filterId);
  }, [categories, filterId]);

  function startEdit(category: TransactionCategoryDto) {
    setEditingId(category.id);
    setDraftTitle(category.title);
    setDraftParentId(category.parentCategoryId);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraftTitle("");
    setDraftParentId(null);
  }

  async function saveEdit() {
    if (!editingCategory) {
      return;
    }
    const title = draftTitle.trim();
    if (!title) {
      toast.error(t("titleRequired"));
      return;
    }
    setSavingId(editingCategory.id);
    try {
      const result = await updateCategory(editingCategory.id, {
        title,
        parentCategoryId: draftParentId,
      });
      const refreshed = await listCategories(pageType);
      setCategories(refreshed.categories);
      cancelEdit();
      toast.success(t("updated"));
      void result;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("updateFailed"));
    } finally {
      setSavingId(null);
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
        cancelEdit();
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
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          {t("subtitle")}
        </p>
      </header>

      <TransactionTypeSwitcher
        value={typeFilter}
        onChange={setTypeFilter}
        className="w-full sm:max-w-md"
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
          typeFilter={typeFilter}
          emptyLabel={t("empty")}
          onStartEdit={startEdit}
          onDelete={setDeleteTarget}
        />
      </section>

      <Dialog
        open={Boolean(editingCategory)}
        onOpenChange={(open) => {
          if (!open && !savingId) {
            cancelEdit();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("editCategory")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label>{t("titleField")}</Label>
              <Input
                className="h-11 rounded-xl text-base"
                value={draftTitle}
                autoFocus
                onChange={(event) => setDraftTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void saveEdit();
                  }
                }}
              />
            </div>
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
                <SelectTrigger className="h-11 w-full rounded-xl">
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
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              disabled={Boolean(savingId)}
              onClick={cancelEdit}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              className="h-11 rounded-xl"
              disabled={Boolean(savingId) || !draftTitle.trim()}
              onClick={() => void saveEdit()}
            >
              {savingId ? <Loader2 className="animate-spin" /> : null}
              {tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
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

function CategoriesListContent({
  loading,
  categories,
  typeFilter,
  emptyLabel,
  onStartEdit,
  onDelete,
}: {
  readonly loading: boolean;
  readonly categories: TransactionCategoryDto[];
  readonly typeFilter: TransactionTypeFilter;
  readonly emptyLabel: string;
  readonly onStartEdit: (category: TransactionCategoryDto) => void;
  readonly onDelete: (category: TransactionCategoryDto) => void;
}) {
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");

  if (loading) {
    return (
      <div className="space-y-0 divide-y divide-border/50">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center justify-between gap-3 px-4 py-3.5"
          >
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-9 w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border/50">
      {categories.map((category) => (
        <li
          key={category.id}
          className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="truncate text-base font-medium">
                {category.path}
              </span>
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
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-10 rounded-xl"
              aria-label={tCommon("edit")}
              onClick={() => onStartEdit(category)}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-10 rounded-xl text-destructive hover:text-destructive"
              aria-label={tCommon("delete")}
              onClick={() => onDelete(category)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
