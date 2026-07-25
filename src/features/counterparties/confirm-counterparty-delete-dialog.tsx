"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

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

type ConfirmCounterpartyDeleteDialogProps = {
  readonly open: boolean;
  readonly name: string;
  readonly loading?: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: () => void;
};

export function ConfirmCounterpartyDeleteDialog({
  open,
  name,
  loading = false,
  onOpenChange,
  onConfirm,
}: ConfirmCounterpartyDeleteDialogProps) {
  const t = useTranslations("counterparties");
  const tCommon = useTranslations("common");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{tCommon("confirm")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("deleteConfirm", { name })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            {tCommon("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={loading}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {loading ? <Loader2 className="animate-spin" /> : null}
            {tCommon("delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
