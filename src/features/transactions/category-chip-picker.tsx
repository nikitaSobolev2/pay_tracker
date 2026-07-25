"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCategory, listCategories } from "@/lib/api/categories";
import { splitCategoryPath } from "@/lib/category-path";
import { cn } from "@/lib/utils";
import type { TransactionType } from "@/types/enums";
import type { TransactionCategoryDto } from "@/types/transaction";

type CategoryChipPickerProps = {
  readonly type: TransactionType;
  readonly selectedIds: string[];
  readonly onChange: (ids: string[]) => void;
};

export function CategoryChipPicker({
  type,
  selectedIds,
  onChange,
}: CategoryChipPickerProps) {
  const t = useTranslations("transaction");
  const tCommon = useTranslations("common");
  const [categories, setCategories] = useState<TransactionCategoryDto[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listCategories(type).then((result) => {
      if (!cancelled) {
        setCategories(result.categories);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [type]);

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
      return;
    }
    onChange([...selectedIds, id]);
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
      if (!selectedIds.includes(existing.id)) {
        onChange([...selectedIds, existing.id]);
      }
      setDraft("");
      return;
    }

    setLoading(true);
    try {
      const result = await createCategory(title, type);
      const refreshed = await listCategories(type);
      setCategories(refreshed.categories);
      onChange([...selectedIds, result.category.id]);
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
      {categories.length > 0 || selectedIds.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => {
            const active = selectedIds.includes(category.id);
            return (
              <button
                key={category.id}
                type="button"
                className="cursor-pointer"
                onClick={() => toggle(category.id)}
              >
                <Badge
                  variant={active ? "default" : "outline"}
                  className={cn(
                    "h-10 max-w-full rounded-full px-3.5 text-sm font-medium",
                    active && "bg-foreground text-background",
                  )}
                >
                  <span className="truncate">{category.path}</span>
                </Badge>
              </button>
            );
          })}
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
      ) : null}
    </div>
  );
}
