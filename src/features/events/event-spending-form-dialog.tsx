"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogHeaderInner,
} from "@/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EVENT_AMOUNT_UNITS } from "@/lib/event-units";
import { EventSpendingCategory } from "@/types/enums";

import { EVENT_CONTROL_CLASS } from "./event-form-controls";
import {
  CATEGORY_LABEL_KEYS,
  CATEGORY_ORDER,
} from "./event-spending-categories";

export type SpendingFormValues = {
  readonly title: string;
  readonly category: EventSpendingCategory;
  readonly amount: string;
  readonly amountUnit: string;
  readonly price: string;
  readonly note: string;
};

export type EventSpendingFormDialogProps = {
  readonly open: boolean;
  readonly initialValues: SpendingFormValues;
  readonly saving: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (values: SpendingFormValues) => Promise<void>;
};

export function emptySpendingValues(): SpendingFormValues {
  return {
    title: "",
    category: EventSpendingCategory.Food,
    amount: "1",
    amountUnit: EVENT_AMOUNT_UNITS[0],
    price: "",
    note: "",
  };
}

export function EventSpendingFormDialog({
  open,
  initialValues,
  saving,
  onOpenChange,
  onSubmit,
}: EventSpendingFormDialogProps) {
  const t = useTranslations("events");
  const tCommon = useTranslations("common");
  const categoryItems = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        value: category,
        label: t(CATEGORY_LABEL_KEYS[category]),
      })),
    [t],
  );
  const unitItems = useMemo(
    () => EVENT_AMOUNT_UNITS.map((unit) => ({ value: unit, label: unit })),
    [],
  );
  const [values, setValues] = useState<SpendingFormValues>(initialValues);
  const [loadedValues, setLoadedValues] =
    useState<SpendingFormValues>(initialValues);

  if (open && loadedValues !== initialValues) {
    setLoadedValues(initialValues);
    setValues(initialValues);
  }

  const isValid =
    values.title.trim().length > 0 &&
    isPositiveNumber(values.amount) &&
    isPositiveNumber(values.price);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) {
          onOpenChange(next);
        }
      }}
    >
      <ResponsiveDialogContent size="md" showCloseButton>
        <ResponsiveDialogHeader>
          <ResponsiveDialogHeaderInner>
            <DialogTitle className="text-xl font-semibold tracking-tight">
              {t("spendingFormTitle")}
            </DialogTitle>
          </ResponsiveDialogHeaderInner>
          <div className="pb-3" />
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody className="space-y-4">
          <div className="space-y-2">
            <Label>{t("spendingTitleField")}</Label>
            <Input
              className={EVENT_CONTROL_CLASS}
              value={values.title}
              autoFocus
              onChange={(changeEvent) =>
                setValues((current) => ({
                  ...current,
                  title: changeEvent.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>{t("spendingCategory")}</Label>
            <Select
              value={values.category}
              items={categoryItems}
              onValueChange={(next) => {
                if (!next) return;
                setValues((current) => ({
                  ...current,
                  category: next as EventSpendingCategory,
                }));
              }}
            >
              <SelectTrigger className={EVENT_CONTROL_CLASS}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categoryItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>{t("spendingAmount")}</Label>
              <Input
                inputMode="decimal"
                className={EVENT_CONTROL_CLASS}
                value={values.amount}
                onChange={(changeEvent) =>
                  setValues((current) => ({
                    ...current,
                    amount: changeEvent.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t("spendingUnit")}</Label>
              <Select
                value={values.amountUnit}
                items={unitItems}
                onValueChange={(next) =>
                  setValues((current) => ({
                    ...current,
                    amountUnit: next ?? current.amountUnit,
                  }))
                }
              >
                <SelectTrigger className={EVENT_CONTROL_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {unitItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("spendingPrice")}</Label>
              <Input
                inputMode="decimal"
                className={EVENT_CONTROL_CLASS}
                value={values.price}
                onChange={(changeEvent) =>
                  setValues((current) => ({
                    ...current,
                    price: changeEvent.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("spendingNote")}</Label>
            <Textarea
              className="min-h-20 rounded-xl text-base md:text-sm"
              value={values.note}
              onChange={(changeEvent) =>
                setValues((current) => ({
                  ...current,
                  note: changeEvent.target.value,
                }))
              }
            />
          </div>
        </ResponsiveDialogBody>

        <ResponsiveDialogFooter>
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full rounded-xl text-base sm:w-auto md:h-10"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            className="h-12 w-full rounded-xl text-base sm:w-auto md:h-10"
            disabled={saving || !isValid}
            onClick={() => void onSubmit(values)}
          >
            {saving ? <Loader2 className="animate-spin" /> : null}
            {tCommon("save")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}

function isPositiveNumber(value: string): boolean {
  return /^\d+(\.\d{1,4})?$/.test(value.trim()) && Number(value) > 0;
}
