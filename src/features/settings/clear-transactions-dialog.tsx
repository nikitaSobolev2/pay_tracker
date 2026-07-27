"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearTransactions } from "@/lib/api/transactions";
import { cn } from "@/lib/utils";

type ClearMode = "all" | "range";

type ClearTransactionsDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

export function ClearTransactionsDialog({
  open,
  onOpenChange,
}: ClearTransactionsDialogProps) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const [mode, setMode] = useState<ClearMode>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setMode("all");
    setStartDate("");
    setEndDate("");
    setLoading(false);
  }, [open]);

  const rangeValid =
    startDate.length > 0 &&
    endDate.length > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(startDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(endDate);
  const canConfirm = mode === "all" || rangeValid;

  async function handleConfirm() {
    if (!canConfirm || loading) {
      return;
    }
    setLoading(true);
    try {
      const result = await clearTransactions(
        mode === "range" ? { startDate, endDate } : {},
      );
      toast.success(t("clearTransactionsSuccess", { count: result.deletedCount }));
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("clearTransactionsFailed"),
      );
      setLoading(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!loading) {
          onOpenChange(next);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("clearTransactions")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("clearTransactionsConfirm")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <ModeButton
              active={mode === "all"}
              disabled={loading}
              label={t("clearTransactionsModeAll")}
              onClick={() => setMode("all")}
            />
            <ModeButton
              active={mode === "range"}
              disabled={loading}
              label={t("clearTransactionsModeRange")}
              onClick={() => setMode("range")}
            />
          </div>

          {mode === "range" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="clear-tx-from">{t("clearTransactionsFrom")}</Label>
                <Input
                  id="clear-tx-from"
                  type="date"
                  value={startDate}
                  disabled={loading}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="clear-tx-to">{t("clearTransactionsTo")}</Label>
                <Input
                  id="clear-tx-to"
                  type="date"
                  value={endDate}
                  disabled={loading}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </div>
            </div>
          ) : null}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            {tCommon("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={loading || !canConfirm}
            onClick={(event) => {
              event.preventDefault();
              void handleConfirm();
            }}
          >
            {loading ? <Loader2 className="animate-spin" /> : null}
            {t("clearTransactions")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ModeButton({
  active,
  disabled,
  label,
  onClick,
}: {
  readonly active: boolean;
  readonly disabled: boolean;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      disabled={disabled}
      className={cn("h-11 rounded-xl text-sm", active && "pointer-events-none")}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
