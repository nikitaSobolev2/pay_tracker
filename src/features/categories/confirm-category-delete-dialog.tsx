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

type ConfirmCategoryDeleteDialogProps = {
  readonly open: boolean;
  readonly title: string;
  readonly loading?: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: () => void;
};

export function ConfirmCategoryDeleteDialog({
  open,
  title,
  loading = false,
  onOpenChange,
  onConfirm,
}: ConfirmCategoryDeleteDialogProps) {
  const t = useTranslations("categories");
  const tCommon = useTranslations("common");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{tCommon("confirm")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("deleteConfirm", { title })}
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
