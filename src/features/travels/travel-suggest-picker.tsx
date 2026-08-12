"use client";

import { ChevronsUpDown, Plane, X } from "lucide-react";
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
  };
}

export function TravelSuggestPicker({
  value,
  onChange,
  className,
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

  return (
    <FormField label={t("travelChooser")} optional className={className}>
      <div className="flex min-w-0 items-start gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="h-auto min-h-11 w-full min-w-0 justify-between gap-2 whitespace-normal px-3 py-2 text-left font-normal"
              />
            }
          >
            {selected ? (
              <TravelChooserRow
                travel={selected}
                schedule={formatSchedule(selected.startsAt, selected.endsAt)}
              />
            ) : (
              <span className="text-muted-foreground">
                {t("travelChooserNone")}
              </span>
            )}
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-(--anchor-width) min-w-(--anchor-width) rounded-xl p-0"
          >
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
                  {cachedTravels.map((travel) => (
                    <CommandItem
                      key={travel.id}
                      value={`${travel.title} ${travel.placeLabel ?? ""}`}
                      data-checked={travel.id === value ? true : undefined}
                      className="min-h-12 items-start gap-2 rounded-lg px-2 py-2 sm:min-h-0"
                      onSelect={() => apply(travel)}
                    >
                      <TravelChooserRow
                        travel={travel}
                        schedule={formatSchedule(
                          travel.startsAt,
                          travel.endsAt,
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {selected ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={ICON_BUTTON_CLASS}
            aria-label={t("travelChooserClear")}
            onClick={() => apply(null)}
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>
    </FormField>
  );
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
