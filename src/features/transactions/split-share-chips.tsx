"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { TransactionSplitShareDto } from "@/types/transaction";

type SplitShareChipsProps = {
  readonly shares: readonly TransactionSplitShareDto[];
  readonly compact?: boolean;
};

export function SplitShareChips({
  shares,
  compact = false,
}: SplitShareChipsProps) {
  const t = useTranslations("transaction");
  const tDetail = useTranslations("transactionDetail");
  const [open, setOpen] = useState(false);

  if (shares.length === 0) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className={cn(
          "relative block max-w-30 overflow-hidden text-left",
          compact ? "h-6" : "h-7",
        )}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <span className="flex w-max gap-1">
          {shares.map((share) => (
            <Badge
              key={share.id}
              variant="outline"
              className={cn(
                "shrink-0 rounded-full font-medium",
                compact ? "h-6 px-2 text-[11px]" : "h-7 px-2.5 text-xs",
              )}
            >
              {share.counterpartyName ?? "—"}
            </Badge>
          ))}
        </span>
        <span className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-background to-transparent" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="sm:max-w-md"
          onClick={(event) => event.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>{tDetail("division")}</DialogTitle>
          </DialogHeader>
          <ul className="space-y-2">
            {shares.map((share) => (
              <li
                key={share.id}
                className="flex items-center justify-between gap-3"
              >
                {share.counterpartyId ? (
                  <Link
                    href={`/debts/${share.counterpartyId}`}
                    className="truncate font-medium underline-offset-4 hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {share.counterpartyName ?? "—"}
                  </Link>
                ) : (
                  <span className="truncate font-medium">
                    {share.counterpartyName ?? "—"}
                  </span>
                )}
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatMoney(share.displayAmount, share.displayCurrency)}
                </span>
              </li>
            ))}
          </ul>
          {shares.length > 2 ? (
            <p className="text-xs text-muted-foreground">
              {t("moreShares", { count: shares.length })}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
