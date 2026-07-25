"use client";

import { Check, Copy, Globe, GlobeLock, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteShare, listShares, updateShare } from "@/lib/api/shares";
import { cn } from "@/lib/utils";
import type { SharedChartDto } from "@/server/services/shared-chart-service";
import type { SharedChartType } from "@/features/share/shared-chart-payload";

export function SharedChartsPage() {
  const t = useTranslations("share");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [items, setItems] = useState<SharedChartDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listShares());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function shareUrl(id: string): string {
    if (typeof window === "undefined") {
      return `/${locale}/share/${id}`;
    }
    return `${window.location.origin}/${locale}/share/${id}`;
  }

  async function handleCopy(id: string) {
    try {
      await navigator.clipboard.writeText(shareUrl(id));
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  async function handleTogglePublic(item: SharedChartDto) {
    setBusyId(item.id);
    try {
      const updated = await updateShare(item.id, { isPublic: !item.isPublic });
      setItems((current) =>
        current.map((row) => (row.id === item.id ? updated : row)),
      );
      toast.success(updated.isPublic ? t("published") : t("closed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("updateFailed"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      await deleteShare(id);
      setItems((current) => current.filter((row) => row.id !== id));
      toast.success(t("deleted"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("deleteFailed"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("pageTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("pageHint")}</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card/80 px-6 py-10 text-center text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-border/60 bg-card/90 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">
                      {item.title?.trim() || t(`chartTypes.${item.chartType}` as `chartTypes.${SharedChartType}`)}
                    </p>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full",
                        item.isPublic
                          ? "border-emerald-500/30 text-emerald-400"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {item.isPublic ? t("statusPublic") : t("statusClosed")}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t(`chartTypes.${item.chartType}` as `chartTypes.${SharedChartType}`)}
                    {" · "}
                    {new Date(item.createdAt).toLocaleString(locale)}
                  </p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {shareUrl(item.id)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-10 rounded-xl"
                    aria-label={t("copy")}
                    onClick={() => {
                      void handleCopy(item.id);
                    }}
                  >
                    <span className="relative inline-flex size-4 items-center justify-center">
                      <Copy
                        className={cn(
                          "absolute size-4 transition-all duration-200",
                          copiedId === item.id
                            ? "scale-50 opacity-0"
                            : "scale-100 opacity-100",
                        )}
                      />
                      <Check
                        className={cn(
                          "absolute size-4 text-emerald-400 transition-all duration-200",
                          copiedId === item.id
                            ? "scale-100 opacity-100"
                            : "scale-50 opacity-0",
                        )}
                      />
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-xl"
                    disabled={busyId === item.id}
                    onClick={() => {
                      void handleTogglePublic(item);
                    }}
                  >
                    {item.isPublic ? (
                      <>
                        <GlobeLock className="size-4" />
                        {t("closeAccess")}
                      </>
                    ) : (
                      <>
                        <Globe className="size-4" />
                        {t("makePublic")}
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-10 rounded-xl text-muted-foreground"
                    aria-label={tCommon("delete")}
                    disabled={busyId === item.id}
                    onClick={() => {
                      void handleDelete(item.id);
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
