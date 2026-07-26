"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCategory, listCategories } from "@/lib/api/categories";
import { splitCategoryPath } from "@/lib/category-path";
import {
  CATEGORY_GROUP_TONES,
  collectDescendantIds,
  groupCategoriesByParent,
  withAncestorSelection,
} from "@/lib/category-selection";
import { cn } from "@/lib/utils";
import type { TransactionType } from "@/types/enums";
import type { TransactionCategoryDto } from "@/types/transaction";

type CategoryChipPickerProps = {
  readonly type: TransactionType;
  readonly selectedIds: string[];
  readonly onChange: (ids: string[]) => void;
  /** When provided, skips internal fetch and uses parent-loaded categories. */
  readonly categories?: TransactionCategoryDto[];
  readonly onCategoriesChange?: (categories: TransactionCategoryDto[]) => void;
};

export function CategoryChipPicker({
  type,
  selectedIds,
  onChange,
  categories: categoriesProp,
  onCategoriesChange,
}: CategoryChipPickerProps) {
  const t = useTranslations("transaction");
  const tCommon = useTranslations("common");
  const [categoriesInternal, setCategoriesInternal] = useState<
    TransactionCategoryDto[]
  >([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const categories = categoriesProp ?? categoriesInternal;

  function replaceCategories(next: TransactionCategoryDto[]) {
    if (onCategoriesChange) {
      onCategoriesChange(next);
      return;
    }
    setCategoriesInternal(next);
  }

  useEffect(() => {
    if (categoriesProp) {
      return;
    }
    let cancelled = false;
    listCategories(type).then((result) => {
      if (!cancelled) {
        setCategoriesInternal(result.categories);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [categoriesProp, type]);

  const groups = useMemo(
    () => groupCategoriesByParent(categories),
    [categories],
  );

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      const removeIds = new Set([
        id,
        ...collectDescendantIds(id, categories),
      ]);
      onChange(selectedIds.filter((item) => !removeIds.has(item)));
      return;
    }
    onChange(withAncestorSelection(selectedIds, id, categories));
  }

  async function handleCreate() {
    const title = draft.trim();
    if (!title) {
      return;
    }

    const segments = splitCategoryPath(title);
    if (segments.length === 0) {
      return;
    }

    const pathKey = segments.join("/").toLowerCase();
    const existing = categories.find(
      (category) => category.path.toLowerCase() === pathKey,
    );
    if (existing) {
      onChange(withAncestorSelection(selectedIds, existing.id, categories));
      setDraft("");
      return;
    }

    setLoading(true);
    try {
      const result = await createCategory(title, type);
      const refreshed = await listCategories(type);
      replaceCategories(refreshed.categories);
      onChange(
        withAncestorSelection(
          selectedIds,
          result.category.id,
          refreshed.categories,
        ),
      );
      setDraft("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("categoryExists"),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          className="h-12 rounded-xl text-base md:h-11"
          placeholder={t("customCategoryPath")}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleCreate();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="h-12 rounded-xl px-4 text-base md:h-11"
          disabled={loading || !draft.trim()}
          onClick={() => {
            void handleCreate();
          }}
        >
          {tCommon("apply")}
        </Button>
      </div>

      {groups.length > 0 ? (
        <div className="space-y-2">
          {groups.map((group) => {
            const tone =
              CATEGORY_GROUP_TONES[
                group.toneIndex % CATEGORY_GROUP_TONES.length
              ]!;
            return (
              <div
                key={group.rootId}
                className={cn("rounded-2xl border p-2", tone.shell)}
              >
                <div className="flex flex-wrap gap-2">
                  {group.members.map((category) => {
                    const active = selectedIds.includes(category.id);
                    return (
                      <button
                        key={category.id}
                        type="button"
                        className="cursor-pointer"
                        onClick={() => toggle(category.id)}
                      >
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-10 max-w-full rounded-full border px-3.5 text-sm font-medium",
                            active ? tone.chipActive : tone.chipIdle,
                          )}
                        >
                          <span className="truncate">{category.title}</span>
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {selectedIds.length > 0 ? (
        <Button
          type="button"
          variant="ghost"
          className="h-10 rounded-full px-3 text-sm"
          onClick={() => onChange([])}
        >
          {tCommon("clearAll")}
        </Button>
      ) : null}
    </div>
  );
}
