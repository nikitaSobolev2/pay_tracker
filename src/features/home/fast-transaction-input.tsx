"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FastEnterPlaceholder } from "@/features/home/fast-enter-placeholder";
import { useAppUser } from "@/hooks/use-app-user";
import {
  getClientCurrencies,
  getCurrencySymbol,
} from "@/lib/currencies";
import { cn } from "@/lib/utils";
import { enqueueFastTransaction } from "@/stores/fast-transaction-queue.store";
import { TransactionFormMode, TransactionType } from "@/types/enums";

const BASE_DIGIT_SLOTS = 5;

function parseAmountInput(raw: string): {
  mode: TransactionFormMode | null;
  digits: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { mode: null, digits: "" };
  }
  if (trimmed.startsWith("+")) {
    return {
      mode: TransactionFormMode.Earning,
      digits: trimmed.slice(1).replace(/[^\d.]/g, ""),
    };
  }
  if (trimmed.startsWith("-")) {
    return {
      mode: TransactionFormMode.Spending,
      digits: trimmed.slice(1).replace(/[^\d.]/g, ""),
    };
  }
  return {
    mode: null,
    digits: trimmed.replace(/[^\d.]/g, ""),
  };
}

export function FastTransactionInput() {
  const t = useTranslations("home");
  const { user } = useAppUser();
  const [mode, setMode] = useState<TransactionFormMode>(
    TransactionFormMode.Spending,
  );
  const [digits, setDigits] = useState("");
  const [currency, setCurrency] = useState("RUB");

  useEffect(() => {
    if (user?.defaultCurrency) {
      setCurrency(user.defaultCurrency);
    }
  }, [user?.defaultCurrency]);

  const placeholderSlides = useMemo(
    () => [
      { amount: "1250", hint: t("fastHintSpending") },
      { amount: "+4800", hint: t("fastHintEarning") },
      { amount: "890", hint: t("fastHintSpendingQuick") },
      { amount: "+12000", hint: t("fastHintEarningQuick") },
      { amount: "3400", hint: t("fastHintSpending") },
    ],
    [t],
  );

  const digitSlots = Math.max(BASE_DIGIT_SLOTS, digits.length || 0);
  const sideShiftPercent = 10 + Math.max(0, digitSlots - BASE_DIGIT_SLOTS) * 5;
  const isEarning = mode === TransactionFormMode.Earning;

  function handleChange(raw: string) {
    const parsed = parseAmountInput(raw);
    if (!parsed.digits) {
      setMode(TransactionFormMode.Spending);
      setDigits("");
      return;
    }
    if (parsed.mode) {
      setMode(parsed.mode);
    }
    setDigits(parsed.digits);
  }

  function submit() {
    if (!digits || Number(digits) <= 0) {
      return;
    }
    const type = isEarning
      ? TransactionType.Earning
      : TransactionType.Spending;
    enqueueFastTransaction({
      localId: uuidv4(),
      type,
      amount: digits,
      currency,
      occurredAt: new Date().toISOString(),
      idempotencyKey: uuidv4(),
    });
    setMode(TransactionFormMode.Spending);
    setDigits("");
  }

  return (
    <section
      className={cn(
        "relative -mx-3 flex h-[calc(100svh-4rem)] w-[calc(100%+1.5rem)] items-center justify-center overflow-hidden",
        "border-y border-border/40",
        "md:mx-0 md:h-[60vh] md:w-full md:rounded-3xl md:border",
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--primary)_26%,transparent),transparent_72%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,color-mix(in_oklch,var(--accent)_42%,transparent),transparent_52%,color-mix(in_oklch,var(--primary)_16%,transparent))]"
      />

      <div className="absolute inset-x-0 top-6 z-10 px-6 text-center md:top-8">
        <h2 className="text-lg font-semibold tracking-tight md:text-xl">
          {t("fastTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("fastSubtitle")}</p>
      </div>

      <div className="relative z-10 flex w-full items-center justify-center px-4">
        <div
          className="relative leading-none"
          style={{
            width: `calc(${digitSlots}ch + 0.15em)`,
            fontSize: "clamp(2.8rem, 9vw, 5.75rem)",
          }}
        >
          <div
            className="absolute top-1/2 z-20"
            style={{
              left: `-${sideShiftPercent}%`,
              transform: "translate(-110%, -62%)",
              fontSize: "0.95em",
            }}
          >
            <button
              type="button"
              aria-label={
                isEarning ? t("fastSwitchToSpending") : t("fastSwitchToEarning")
              }
              aria-pressed={isEarning}
              onClick={() =>
                setMode(
                  isEarning
                    ? TransactionFormMode.Spending
                    : TransactionFormMode.Earning,
                )
              }
              className={cn(
                "cursor-pointer select-none font-semibold leading-none outline-none",
                "transition-transform duration-200 hover:scale-110 active:scale-95",
                "focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isEarning ? "text-emerald-400" : "text-rose-400",
              )}
            >
              {isEarning ? "+" : "−"}
            </button>
          </div>

          <div className="relative">
            <FastEnterPlaceholder
              slides={placeholderSlides}
              visible={!digits}
            />
            <input
              aria-label={t("fastInputAria")}
              inputMode="decimal"
              autoComplete="off"
              value={digits}
              onChange={(event) => handleChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "+") {
                  event.preventDefault();
                  setMode(TransactionFormMode.Earning);
                  return;
                }
                if (event.key === "-") {
                  event.preventDefault();
                  setMode(TransactionFormMode.Spending);
                  return;
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                }
              }}
              onPaste={(event) => {
                const text = event.clipboardData.getData("text");
                if (
                  text.includes("+") ||
                  text.includes("-") ||
                  /[^\d.]/.test(text)
                ) {
                  event.preventDefault();
                  handleChange(text);
                }
              }}
              className={cn(
                "relative z-10 w-full bg-transparent text-center font-medium tracking-tight text-foreground tabular-nums outline-none",
                "border-0 border-b-2 border-foreground/30 pb-3 caret-foreground",
                "focus:border-foreground/70",
                !digits && "caret-transparent text-transparent",
              )}
            />
          </div>

          <div
            className="absolute top-1/2"
            style={{
              right: `-${sideShiftPercent}%`,
              transform: "translate(110%, -62%)",
            }}
          >
            <CurrencyIconSelect value={currency} onChange={setCurrency} />
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-8 z-10 flex justify-center px-6 md:hidden">
        <Button
          type="button"
          size="lg"
          className="h-12 w-full max-w-xs rounded-full text-base font-semibold"
          onClick={submit}
          disabled={!digits || Number(digits) <= 0}
        >
          {t("fastAdd")}
        </Button>
      </div>
    </section>
  );
}

function CurrencyIconSelect({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  const currencies = getClientCurrencies();

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (typeof next === "string") {
          onChange(next);
        }
      }}
    >
      <SelectTrigger
        className={cn(
          "h-auto gap-1 border-0 bg-transparent p-0 shadow-none dark:bg-transparent",
          "text-[0.72em] leading-none font-medium text-foreground/80",
          "hover:bg-transparent hover:text-foreground dark:hover:bg-transparent",
          "focus-visible:border-transparent focus-visible:ring-0",
          "[&_svg]:size-[0.45em] [&_svg]:opacity-55",
        )}
      >
        <SelectValue>{getCurrencySymbol(value)}</SelectValue>
      </SelectTrigger>
      <SelectContent
        align="center"
        className="min-w-19 rounded-xl border-border/60 bg-popover/95 backdrop-blur"
      >
        {currencies.map((currencyCode) => (
          <SelectItem
            key={currencyCode}
            value={currencyCode}
            className="justify-center py-3 text-3xl font-medium"
          >
            <span className="inline-flex min-w-10 justify-center">
              {getCurrencySymbol(currencyCode)}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
