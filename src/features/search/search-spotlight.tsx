"use client";

import {
  CalendarRange,
  HandCoins,
  Loader2,
  Receipt,
  Search,
  Tags,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useRouter } from "@/i18n/navigation";
import {
  searchAll,
  type SearchResponse,
} from "@/lib/api/search";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { TransactionType } from "@/types/enums";

type SearchSpotlightProps = {
  readonly className?: string;
};

export function SearchSpotlight({ className }: SearchSpotlightProps) {
  const t = useTranslations("search");
  const tTx = useTranslations("transaction");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 200);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResponse | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const q = debouncedQuery.trim();
    if (!q) {
      setResult(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    searchAll(q)
      .then((next) => {
        if (!cancelled) {
          setResult(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResult(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, open]);

  const closeAndGo = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      setResult(null);
      router.push(href);
    },
    [router],
  );

  const groups = result?.groups;
  const hasResults =
    Boolean(groups) &&
    ((groups?.categories.length ?? 0) > 0 ||
      (groups?.counterparties.length ?? 0) > 0 ||
      (groups?.debts.length ?? 0) > 0 ||
      (groups?.dateRanges.length ?? 0) > 0 ||
      (groups?.transactions.length ?? 0) > 0);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={cn(
          "size-9 shrink-0 rounded-xl border-border/70 bg-card/40 p-0 text-muted-foreground",
          "md:h-8 md:w-64 md:justify-start md:gap-2 md:px-3",
          className,
        )}
        onClick={() => setOpen(true)}
        aria-label={t("shortcut")}
      >
        <Search className="size-4 shrink-0" />
        <span className="hidden truncate text-sm md:inline">{t("shortcut")}</span>
        <kbd className="pointer-events-none ml-auto hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground md:inline">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setQuery("");
            setResult(null);
          }
        }}
        title={t("shortcut")}
        description={t("placeholder")}
        className="top-[10%] w-[calc(100%-1rem)] max-w-none sm:top-1/4 sm:max-w-2xl md:max-w-3xl"
      >
        <Command
          shouldFilter={false}
          className={cn(
            "rounded-xl",
            "[&_[data-slot=command-item]]:min-h-12 [&_[data-slot=command-item]]:gap-3 [&_[data-slot=command-item]]:px-3 [&_[data-slot=command-item]]:py-3 [&_[data-slot=command-item]]:text-base",
            "sm:[&_[data-slot=command-item]]:min-h-0 sm:[&_[data-slot=command-item]]:gap-2 sm:[&_[data-slot=command-item]]:px-2 sm:[&_[data-slot=command-item]]:py-1.5 sm:[&_[data-slot=command-item]]:text-sm",
            "[&_[data-slot=command-item]_svg]:size-5 sm:[&_[data-slot=command-item]_svg]:size-4",
            // Hide cmdk checkmark so trailing chips/amounts sit flush right.
            "[&_[data-slot=command-item]>svg:last-of-type]:hidden",
          )}
        >
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={t("placeholder")}
            wrapperClassName="p-2 pb-1 sm:p-1.5 sm:pb-0"
            inputGroupClassName="h-14! rounded-xl! *:data-[slot=input-group-addon]:pl-3! sm:h-11! [&_svg]:size-5 sm:[&_svg]:size-4"
            className="text-base sm:text-sm"
          />
          <CommandList className="max-h-[min(70dvh,36rem)] sm:max-h-[min(28rem,60vh)]">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-base text-muted-foreground sm:py-8 sm:text-sm">
                <Loader2 className="size-5 animate-spin sm:size-4" />
              </div>
            ) : null}

            {!loading && !query.trim() ? (
              <CommandEmpty className="py-10 text-base sm:py-6 sm:text-sm">
                {t("typeToSearch")}
              </CommandEmpty>
            ) : null}

            {!loading && query.trim() && !hasResults ? (
              <CommandEmpty className="py-10 text-base sm:py-6 sm:text-sm">
                {t("empty")}
              </CommandEmpty>
            ) : null}

            {groups?.dateRanges.map((item) => (
              <CommandGroup key={item.label} heading={t("groupDates")}>
                <CommandItem
                  value={`date-${item.startDate}`}
                  onSelect={() =>
                    closeAndGo(
                      `/transactions?startDate=${encodeURIComponent(item.startDate)}&endDate=${encodeURIComponent(item.endDate)}`,
                    )
                  }
                >
                  <CalendarRange />
                  <span className="truncate">{t("viewPeriod")}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {item.label}
                  </span>
                </CommandItem>
              </CommandGroup>
            ))}

            {groups && groups.categories.length > 0 ? (
              <CommandGroup heading={t("groupCategories")}>
                {groups.categories.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`category-${item.id}`}
                    onSelect={() =>
                      closeAndGo(`/categories?id=${encodeURIComponent(item.id)}`)
                    }
                  >
                    <Tags />
                    <span className="min-w-0 flex-1 truncate">{item.path}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 rounded-full px-2.5 text-xs font-medium",
                        item.type === TransactionType.Earning
                          ? "border-emerald-500/30 text-emerald-400"
                          : "border-rose-500/30 text-rose-400",
                      )}
                    >
                      {item.type === TransactionType.Earning
                        ? tTx("earning")
                        : tTx("spending")}
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {groups && groups.counterparties.length > 0 ? (
              <CommandGroup heading={t("groupCounterparties")}>
                {groups.counterparties.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`counterparty-${item.id}`}
                    onSelect={() =>
                      closeAndGo(
                        `/counterparties?id=${encodeURIComponent(item.id)}`,
                      )
                    }
                  >
                    <Users />
                    <span className="truncate">{item.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {groups && groups.debts.length > 0 ? (
              <CommandGroup heading={t("groupDebts")}>
                {groups.debts.map((item) => (
                  <CommandItem
                    key={item.counterpartyId}
                    value={`debt-${item.counterpartyId}`}
                    onSelect={() =>
                      closeAndGo(`/debts/${item.counterpartyId}`)
                    }
                  >
                    <HandCoins />
                    <span className="min-w-0 flex-1 truncate">
                      {item.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {item.tone === "owe" ? t("owe") : t("owed")}
                      </span>
                    </span>
                    <span className="tabular-nums">
                      {formatMoney(
                        item.totalAllTimeAmount,
                        item.displayCurrency,
                      )}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {groups && groups.transactions.length > 0 ? (
              <CommandGroup heading={t("groupTransactions")}>
                {groups.transactions.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`tx-${item.id}`}
                    onSelect={() => closeAndGo(`/transactions/${item.id}`)}
                  >
                    <Receipt />
                    <span className="min-w-0 flex-1 truncate">
                      {item.title || item.categoryPaths[0] || "—"}
                    </span>
                    {item.categoryPaths.length > 0 ? (
                      <span className="flex max-w-[45%] shrink-0 items-center justify-end gap-1 overflow-hidden sm:max-w-[50%]">
                        {item.categoryPaths.slice(0, 3).map((path, index) => (
                          <Badge
                            key={`${item.id}-${path}-${index}`}
                            variant="outline"
                            className={cn(
                              "max-w-28 truncate rounded-full px-2 text-[10px] font-medium text-muted-foreground sm:text-xs",
                              index >= 2 && "hidden sm:inline-flex",
                            )}
                            title={path}
                          >
                            {path}
                          </Badge>
                        ))}
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "shrink-0 tabular-nums",
                        item.type === TransactionType.Spending
                          ? "text-rose-400"
                          : "text-emerald-400",
                      )}
                    >
                      {formatMoney(item.displayAmount, item.displayCurrency)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
