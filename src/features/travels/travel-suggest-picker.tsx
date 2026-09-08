"use client";

import { Ban, ChevronsUpDown, Plane, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { FormField } from "@/components/ui/form-field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ICON_BUTTON_CLASS } from "@/lib/bento";
import { listTravels } from "@/lib/api/travels";
import { cn } from "@/lib/utils";
import type {
  TravelListItemDto,
  TravelSuggestItemDto,
} from "@/server/services/travel-service.types";
import { useTransactionFormLookupStore } from "@/stores/transaction-form-lookup.store";

import { TravelPhaseBadge } from "./travel-phase-badge";
import { useTravelScheduleLabel } from "./use-travel-schedule-label";

export type TravelSuggestPickerProps = {
  readonly value: string | null;
  readonly onChange: (travelId: string | null) => void;
  readonly className?: string;
  readonly layout?: "form" | "filter";
  readonly triggerClassName?: string;
};

function toSuggestItem(travel: TravelListItemDto): TravelSuggestItemDto {
  return {
    id: travel.id,
    title: travel.title,
    startsAt: travel.startsAt,
    endsAt: travel.endsAt,
    placeLabel: travel.placeLabel,
    imageUrl: travel.imageUrl,
    phase: travel.phase,
    currency: travel.currency,
    firstSpendingAt: travel.firstSpendingAt ?? null,
    lastSpendingAt: travel.lastSpendingAt ?? null,
    firstTransactionAt: travel.firstTransactionAt ?? null,
    lastTransactionAt: travel.lastTransactionAt ?? null,
  };
}

export function TravelSuggestPicker({
  value,
  onChange,
  className,
  layout = "form",
  triggerClassName,
}: TravelSuggestPickerProps) {
  const t = useTranslations("travels");
  const formatSchedule = useTravelScheduleLabel();
  const [open, setOpen] = useState(false);
  const cachedTravels = useTransactionFormLookupStore((state) => state.travels);
  const setTravels = useTransactionFormLookupStore((state) => state.setTravels);
  const [selected, setSelected] = useState<TravelSuggestItemDto | null>(null);

  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    const match = cachedTravels.find((travel) => travel.id === value);
    if (match) {
      setSelected(match);
    }
  }, [cachedTravels, value]);

  useEffect(() => {
    let cancelled = false;
    void listTravels()
      .then((result) => {
        if (cancelled) {
          return;
        }
        const next = result.travels.map(toSuggestItem);
        setTravels(next);
        if (value) {
          const match = next.find((travel) => travel.id === value);
          if (match) {
            setSelected(match);
          }
        }
      })
      .catch(() => {
        // Offline: keep persisted travels list.
      });
    return () => {
      cancelled = true;
    };
  }, [setTravels, value]);

  function apply(travel: TravelSuggestItemDto | null) {
    setSelected(travel);
    onChange(travel?.id ?? null);
    setOpen(false);
  }

  const filterLayout = layout === "filter";
  const chooser = (
    <div className="flex min-w-0 items-start gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            filterLayout ? (
              <button
                type="button"
                aria-label={t("travelChooser")}
                className={chooserTriggerClassName(
                  true,
                  Boolean(value),
                  triggerClassName,
                )}
              />
            ) : (
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={open}
                aria-label={t("travelChooser")}
                className={chooserTriggerClassName(
                  false,
                  Boolean(value),
                  triggerClassName,
                )}
              />
            )
          }
        >
          <TravelChooserTriggerLabel
            filterLayout={filterLayout}
            selected={selected}
            value={value}
            schedule={
              selected
                ? formatSchedule(selected.startsAt, selected.endsAt)
                : ""
            }
          />
          <ChevronsUpDown
            className={cn(
              "shrink-0 opacity-70",
              filterLayout ? "size-3.5" : "size-4 opacity-50",
            )}
          />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className={cn(
            "rounded-xl p-0",
            filterLayout
              ? "w-72"
              : "w-(--anchor-width) min-w-(--anchor-width)",
          )}
        >
          <TravelChooserList
            value={value}
            travels={cachedTravels}
            formatSchedule={formatSchedule}
            onPick={apply}
          />
        </PopoverContent>
      </Popover>
      {value && !filterLayout ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(ICON_BUTTON_CLASS, "size-11 shrink-0")}
          aria-label={t("travelChooserClear")}
          onClick={() => apply(null)}
        >
          <X className="size-4" />
        </Button>
      ) : null}
    </div>
  );

  if (filterLayout) {
    return <div className={className}>{chooser}</div>;
  }

  return (
    <FormField label={t("travelChooser")} optional className={className}>
      {chooser}
    </FormField>
  );
}

function chooserTriggerClassName(
  filterLayout: boolean,
  hasValue: boolean,
  triggerClassName?: string,
): string {
  if (!filterLayout) {
    return cn(
      "h-auto min-h-11 w-full min-w-0 justify-between gap-2 whitespace-normal px-3 py-2 text-left font-normal",
      triggerClassName,
    );
  }
  return cn(
    "inline-flex h-10 max-w-56 min-w-36 cursor-pointer items-center justify-between gap-1.5 overflow-hidden rounded-full border px-3.5 text-left text-sm font-medium transition-colors",
    hasValue
      ? "border-foreground/25 bg-foreground text-background hover:bg-foreground hover:text-background"
      : "border-border/70 bg-card/60 text-foreground hover:bg-muted/40",
    triggerClassName,
  );
}

function TravelChooserTriggerLabel({
  filterLayout,
  selected,
  value,
  schedule,
}: {
  readonly filterLayout: boolean;
  readonly selected: TravelSuggestItemDto | null;
  readonly value: string | null;
  readonly schedule: string;
}) {
  const t = useTranslations("travels");
  if (filterLayout) {
    const label = selectedTravelChipLabel(selected, value, t);
    return (
      <span className="min-w-0 truncate">
        {t("travelChooser")}: {label}
      </span>
    );
  }
  if (selected) {
    return <TravelChooserRow travel={selected} schedule={schedule} />;
  }
  if (value) {
    return (
      <span className="truncate text-sm font-medium">
        {t("travelChooserUnknown")}
      </span>
    );
  }
  return (
    <span className="text-muted-foreground">{t("travelChooserNone")}</span>
  );
}

function TravelChooserList({
  value,
  travels,
  formatSchedule,
  onPick,
}: {
  readonly value: string | null;
  readonly travels: readonly TravelSuggestItemDto[];
  readonly formatSchedule: (startsAt: string, endsAt: string | null) => string;
  readonly onPick: (travel: TravelSuggestItemDto | null) => void;
}) {
  const t = useTranslations("travels");
  return (
    <Command
      className={cn(
        "rounded-xl",
        "[&_[data-slot=command-item]>svg:last-of-type]:hidden",
      )}
    >
      <CommandInput
        placeholder={t("travelChooserSearch")}
        wrapperClassName="p-2 pb-1 sm:p-1.5 sm:pb-0"
        inputGroupClassName="h-12! rounded-xl! *:data-[slot=input-group-addon]:pl-3! sm:h-10! [&_svg]:size-5 sm:[&_svg]:size-4"
        className="text-base sm:text-sm"
      />
      <CommandList className="max-h-[min(50dvh,20rem)]">
        <CommandEmpty className="py-8 text-base sm:py-6 sm:text-sm">
          {t("travelChooserEmpty")}
        </CommandEmpty>
        <CommandGroup className="p-1.5 sm:p-1">
          <CommandItem
            value={t("travelChooserNone")}
            data-checked={!value ? true : undefined}
            className="min-h-12 items-center gap-2 rounded-lg px-2 py-2 sm:min-h-11"
            onSelect={() => onPick(null)}
          >
            <Ban className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-sm">{t("travelChooserNone")}</span>
          </CommandItem>
          {travels.map((travel) => (
            <CommandItem
              key={travel.id}
              value={`${travel.title} ${travel.placeLabel ?? ""}`}
              data-checked={travel.id === value ? true : undefined}
              className="min-h-12 items-start gap-2 rounded-lg px-2 py-2 sm:min-h-0"
              onSelect={() => onPick(travel)}
            >
              <TravelChooserRow
                travel={travel}
                schedule={formatSchedule(travel.startsAt, travel.endsAt)}
              />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

function selectedTravelChipLabel(
  selected: TravelSuggestItemDto | null,
  value: string | null,
  t: ReturnType<typeof useTranslations<"travels">>,
): string {
  if (selected) {
    return selected.title;
  }
  if (value) {
    return t("travelChooserUnknown");
  }
  return t("travelChooserNone");
}

function TravelChooserRow({
  travel,
  schedule,
}: {
  readonly travel: TravelSuggestItemDto;
  readonly schedule: string;
}) {
  const meta = [schedule, travel.placeLabel].filter(Boolean).join(" · ");

  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <Plane className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{travel.title}</span>
        {meta ? (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {meta}
          </span>
        ) : null}
      </span>
      <TravelPhaseBadge phase={travel.phase} />
    </span>
  );
}
