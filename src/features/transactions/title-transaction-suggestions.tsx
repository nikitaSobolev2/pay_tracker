"use client";

import { useTranslations } from "next-intl";
import {
  useEffect,
  useLayoutEffect,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useReadableDateTime } from "@/hooks/use-readable-date-time";
import { suggestTransactionsByTitle } from "@/lib/api/transactions";
import { formatChartMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { TransactionType } from "@/types/enums";
import type { TransactionDto } from "@/types/transaction";

type TitleTransactionSuggestionsProps = {
  readonly query: string;
  readonly type: TransactionType;
  readonly enabled: boolean;
  readonly onApply: (transaction: TransactionDto) => void;
  /** Dialog content element — desktop panel anchors to its right edge. */
  readonly anchorRef?: RefObject<HTMLElement | null>;
};

type PanelBox = {
  readonly top: number;
  readonly left: number;
  readonly height: number;
};

export function TitleTransactionSuggestions({
  query,
  type,
  enabled,
  onApply,
  anchorRef,
}: TitleTransactionSuggestionsProps) {
  const t = useTranslations("transaction");
  const tCommon = useTranslations("common");
  const formatReadableDate = useReadableDateTime();
  const debouncedQuery = useDebouncedValue(query.trim(), 200);
  const [items, setItems] = useState<TransactionDto[]>([]);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenQuery, setFullscreenQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelBox, setPanelBox] = useState<PanelBox | null>(null);
  const [mounted, setMounted] = useState(false);
  /** Keep list stable after apply until the user edits the title. */
  const [pinnedFetchQuery, setPinnedFetchQuery] = useState<string | null>(null);
  const [appliedTitle, setAppliedTitle] = useState<string | null>(null);
  const [appliedId, setAppliedId] = useState<string | null>(null);

  const fetchQuery = pinnedFetchQuery ?? debouncedQuery;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setPinnedFetchQuery(null);
      setAppliedTitle(null);
      setAppliedId(null);
      setItems([]);
    }
  }, [enabled]);

  useEffect(() => {
    if (pinnedFetchQuery == null || appliedTitle == null) {
      return;
    }
    if (query.trim() !== appliedTitle) {
      setPinnedFetchQuery(null);
      setAppliedTitle(null);
      setAppliedId(null);
    }
  }, [appliedTitle, pinnedFetchQuery, query]);

  useEffect(() => {
    if (!enabled || fetchQuery.length < 1) {
      if (!pinnedFetchQuery) {
        setItems([]);
      }
      return;
    }
    let cancelled = false;
    void suggestTransactionsByTitle({
      q: fetchQuery,
      type,
      limit: 20,
    }).then((result) => {
      if (!cancelled) {
        setItems(result.items);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, fetchQuery, pinnedFetchQuery, type]);

  useEffect(() => {
    if (!fullscreenOpen) {
      return;
    }
    const q = fullscreenQuery.trim() || fetchQuery;
    if (!q) {
      return;
    }
    let cancelled = false;
    void suggestTransactionsByTitle({ q, type, limit: 50 }).then((result) => {
      if (!cancelled) {
        setItems(result.items);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fetchQuery, fullscreenOpen, fullscreenQuery, type]);

  function handleApply(transaction: TransactionDto) {
    const searchSeed = (pinnedFetchQuery ?? query).trim();
    if (searchSeed.length > 0) {
      setPinnedFetchQuery(searchSeed);
    }
    setAppliedTitle((transaction.title ?? "").trim());
    setAppliedId(transaction.id);
    onApply(transaction);
  }

  useLayoutEffect(() => {
    if (!enabled || items.length === 0) {
      setPanelBox(null);
      return;
    }

    const update = () => {
      const anchor =
        anchorRef?.current ??
        document.querySelector<HTMLElement>(
          "[data-slot='dialog-content'][data-transaction-form]",
        );
      if (!anchor) {
        setPanelBox(null);
        return;
      }
      const rect = anchor.getBoundingClientRect();
      const gap = 12;
      const width = 288;
      const viewportPadding = 8;
      let left = rect.right + gap;
      if (left + width > window.innerWidth - viewportPadding) {
        left = Math.max(viewportPadding, rect.left - gap - width);
      }
      setPanelBox({
        top: rect.top,
        left,
        height: rect.height,
      });
    };

    update();
    const anchor =
      anchorRef?.current ??
      document.querySelector<HTMLElement>(
        "[data-slot='dialog-content'][data-transaction-form]",
      );
    const observer =
      anchor == null ? null : new ResizeObserver(update);
    if (anchor && observer) {
      observer.observe(anchor);
    }
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchorRef, enabled, items.length]);

  if (!enabled || items.length === 0) {
    return null;
  }

  const selected = items.find((item) => item.id === selectedId) ?? null;

  const panelStyle: CSSProperties | undefined = panelBox
    ? {
        top: panelBox.top,
        left: panelBox.left,
        height: panelBox.height,
        width: 288,
      }
    : undefined;

  const desktopPanel = (
    <aside
      className={cn(
        "fixed hidden flex-col overflow-hidden rounded-2xl border border-border/60 bg-popover shadow-lg sm:flex",
      )}
      style={{ zIndex: 1300, ...panelStyle }}
    >
      <div className="border-b border-border/50 px-3 py-2 text-xs font-medium text-muted-foreground">
        {t("titleSuggestions")}
      </div>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {items.map((item) => (
          <SuggestionRow
            key={item.id}
            item={item}
            formatDate={formatReadableDate}
            selected={item.id === appliedId}
            onClick={() => handleApply(item)}
          />
        ))}
      </ul>
    </aside>
  );

  return (
    <>
      {mounted && panelBox
        ? createPortal(desktopPanel, document.body)
        : null}

      {/* Mobile: compact block under title */}
      <div className="space-y-2 sm:hidden">
        <ul className="space-y-1.5">
          {items.slice(0, 2).map((item) => (
            <SuggestionRow
              key={item.id}
              item={item}
              formatDate={formatReadableDate}
              selected={item.id === appliedId}
              onClick={() => handleApply(item)}
            />
          ))}
        </ul>
        {items.length > 2 ? (
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full rounded-xl"
            onClick={() => {
              setFullscreenQuery(query);
              setSelectedId(appliedId);
              setFullscreenOpen(true);
            }}
          >
            {t("showOtherSuggestions")}
          </Button>
        ) : null}
      </div>

      {fullscreenOpen ? (
        <div className="fixed inset-0 z-[100] flex flex-col bg-background sm:hidden">
          <div className="border-b border-border/60 p-3">
            <Input
              className="h-12 rounded-xl text-base"
              value={fullscreenQuery}
              onChange={(event) => setFullscreenQuery(event.target.value)}
              placeholder={t("title")}
              autoFocus
            />
          </div>
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
            {items.map((item) => (
              <SuggestionRow
                key={item.id}
                item={item}
                formatDate={formatReadableDate}
                selected={item.id === selectedId || item.id === appliedId}
                onClick={() => setSelectedId(item.id)}
              />
            ))}
          </ul>
          <div className="flex gap-2 border-t border-border/60 p-3">
            <Button
              type="button"
              variant="outline"
              className="h-12 flex-1 rounded-xl"
              onClick={() => setFullscreenOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              className="h-12 flex-1 rounded-xl"
              disabled={!selected}
              onClick={() => {
                if (!selected) {
                  return;
                }
                handleApply(selected);
                setFullscreenOpen(false);
              }}
            >
              {tCommon("apply")}
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function SuggestionRow({
  item,
  formatDate,
  onClick,
  selected = false,
}: {
  readonly item: TransactionDto;
  readonly formatDate: (value: string | Date) => string;
  readonly onClick: () => void;
  readonly selected?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        className={cn(
          "w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
          selected
            ? "border-primary bg-primary/15 ring-1 ring-primary/30"
            : "border-border/50 bg-card/40 hover:bg-muted/50",
        )}
        onClick={onClick}
      >
        <div
          className={cn(
            "truncate text-sm font-medium",
            selected && "text-primary",
          )}
        >
          {item.title || "—"}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">{formatDate(item.occurredAt)}</span>
          <span className="shrink-0 tabular-nums">
            {formatChartMoney(item.displayAmount, item.displayCurrency)}
          </span>
        </div>
      </button>
    </li>
  );
}
