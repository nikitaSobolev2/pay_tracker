"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useReadableDateTime } from "@/hooks/use-readable-date-time";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useFastTransactionQueueStore } from "@/stores/fast-transaction-queue.store";
import { FastQueueStatus, TransactionType } from "@/types/enums";

export function FastTransactionQueueTable() {
  const t = useTranslations("home");
  const formatReadableDateTime = useReadableDateTime();
  const items = useFastTransactionQueueStore((state) => state.items);
  const hydrated = useFastTransactionQueueStore((state) => state.hydrated);
  const retryPending = useFastTransactionQueueStore(
    (state) => state.retryPending,
  );

  useEffect(() => {
    function onOnline() {
      void retryPending();
    }
    function onFocus() {
      void retryPending();
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
    };
  }, [retryPending]);

  if (!hydrated || items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{t("queueTitle")}</div>
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("queueAmount")}</TableHead>
              <TableHead>{t("queueTime")}</TableHead>
              <TableHead>{t("queueStatus")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const isEarning = item.type === TransactionType.Earning;
              return (
                <TableRow key={item.localId}>
                  <TableCell
                    className={cn(
                      "font-medium tabular-nums",
                      isEarning ? "text-emerald-400" : "text-rose-400",
                    )}
                  >
                    {isEarning ? "+" : "−"}
                    {formatMoney(item.amount, item.currency)}
                  </TableCell>
                  <TableCell>
                    {formatReadableDateTime(item.createdAtLocal)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {item.status === FastQueueStatus.Pending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : null}
                      <Badge
                        variant={
                          item.status === FastQueueStatus.Success
                            ? "default"
                            : item.status === FastQueueStatus.Error
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {t(item.status)}
                      </Badge>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
