"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  listCounterparties,
  type CounterpartyDto,
} from "@/lib/api/counterparties";
import { cn } from "@/lib/utils";
import { useTransactionFormLookupStore } from "@/stores/transaction-form-lookup.store";
import type { TransactionKind } from "@/types/enums";

type CounterpartyAutocompleteProps = {
  readonly kind: TransactionKind;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly className?: string;
  readonly inactive?: boolean;
  /** When provided, skips chip fetch and uses parent-loaded counterparties. */
  readonly chips?: CounterpartyDto[];
};

export function CounterpartyAutocomplete({
  kind,
  value,
  onChange,
  placeholder,
  className,
  inactive = false,
  chips: chipsProp,
}: CounterpartyAutocompleteProps) {
  const debounced = useDebouncedValue(value, 300);
  const [suggestions, setSuggestions] = useState<CounterpartyDto[]>([]);
  const [chipsInternal, setChipsInternal] = useState<CounterpartyDto[]>([]);
  const [open, setOpen] = useState(false);
  const chips = chipsProp ?? chipsInternal;

  useEffect(() => {
    if (chipsProp || inactive) {
      return;
    }
    const cached = useTransactionFormLookupStore
      .getState()
      .getCounterparties(kind);
    if (cached.length > 0) {
      setChipsInternal(cached);
    }
    let cancelled = false;
    void listCounterparties({ kind })
      .then((result) => {
        useTransactionFormLookupStore
          .getState()
          .setCounterparties(kind, result.counterparties);
        if (!cancelled) {
          setChipsInternal(result.counterparties);
        }
      })
      .catch(() => {
        // Offline: keep cached chips.
      });
    return () => {
      cancelled = true;
    };
  }, [chipsProp, inactive, kind]);

  useEffect(() => {
    let cancelled = false;
    function applyFromCache() {
      const cached = useTransactionFormLookupStore
        .getState()
        .getCounterparties(kind);
      const needle = debounced.trim().toLowerCase();
      const next = needle
        ? cached.filter((item) =>
            item.name.toLowerCase().includes(needle),
          )
        : cached;
      if (!cancelled) {
        setSuggestions(next);
      }
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      applyFromCache();
      return () => {
        cancelled = true;
      };
    }
    void listCounterparties({ kind, q: debounced || undefined })
      .then((result) => {
        if (!cancelled) {
          setSuggestions(result.counterparties);
        }
      })
      .catch(() => {
        applyFromCache();
      });
    return () => {
      cancelled = true;
    };
  }, [kind, debounced]);

  function selectName(name: string) {
    onChange(name);
    setOpen(false);
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        <Input
          className="h-12 w-full rounded-xl text-base md:h-11"
          value={value}
          placeholder={placeholder}
          tabIndex={inactive ? -1 : undefined}
          aria-hidden={inactive}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (!inactive) {
              setOpen(true);
            }
          }}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        />
        {!inactive && open && suggestions.length > 0 ? (
          <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border bg-popover p-1 shadow-md">
            {suggestions.map((option) => (
              <button
                key={option.id}
                type="button"
                className="flex min-h-11 w-full cursor-pointer rounded-lg px-3 py-2.5 text-left text-base hover:bg-accent"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectName(option.name)}
              >
                {option.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {!inactive && chips.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {chips.map((item) => {
            const active =
              value.trim().toLowerCase() === item.name.trim().toLowerCase();
            return (
              <button
                key={item.id}
                type="button"
                className="cursor-pointer"
                onClick={() => selectName(item.name)}
              >
                <Badge
                  variant={active ? "default" : "outline"}
                  className={cn(
                    "h-10 rounded-full px-3.5 text-sm font-medium",
                    active && "bg-foreground text-background",
                  )}
                >
                  {item.name}
                </Badge>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
