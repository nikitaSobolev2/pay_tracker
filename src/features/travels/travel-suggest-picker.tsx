"use client";

import { Plane, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { suggestTravels } from "@/lib/api/travels";
import { cn } from "@/lib/utils";
import type { TravelSuggestItemDto } from "@/server/services/travel-service.types";

import { TravelPhaseBadge } from "./travel-phase-badge";
import { useTravelScheduleLabel } from "./use-travel-schedule-label";

export type TravelSuggestPickerProps = {
  readonly value: string | null;
  readonly onChange: (travelId: string | null) => void;
  readonly className?: string;
};

export function TravelSuggestPicker({
  value,
  onChange,
  className,
}: TravelSuggestPickerProps) {
  const t = useTranslations("travels");
  const formatSchedule = useTravelScheduleLabel();
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 200);
  const [items, setItems] = useState<TravelSuggestItemDto[]>([]);
  const [selected, setSelected] = useState<TravelSuggestItemDto | null>(null);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void suggestTravels(debounced).then((result) => {
      if (!cancelled) {
        setItems(result.travels);
        if (value) {
          const match = result.travels.find((travel) => travel.id === value);
          if (match) {
            setSelected(match);
          }
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [debounced, value]);

  function apply(travel: TravelSuggestItemDto | null) {
    setSelected(travel);
    onChange(travel?.id ?? null);
    setFullscreenOpen(false);
  }

  const preview = items.slice(0, 2);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label>{t("travelChooser")}</Label>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-lg"
            onClick={() => apply(null)}
          >
            <X className="size-3.5" />
            {t("travelChooserClear")}
          </Button>
        ) : null}
      </div>

      {selected ? (
        <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
          <Plane className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{selected.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {formatSchedule(selected.startsAt, selected.endsAt)}
              {selected.placeLabel ? ` · ${selected.placeLabel}` : ""}
            </p>
          </div>
          <TravelPhaseBadge phase={selected.phase} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("travelChooserNone")}</p>
      )}

      <div className="space-y-2 sm:hidden">
        {preview.map((travel) => (
          <button
            key={travel.id}
            type="button"
            className="flex min-h-12 w-full items-center gap-2 rounded-xl border border-border/50 px-3 py-2 text-left"
            onClick={() => apply(travel)}
          >
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {travel.title}
            </span>
            <TravelPhaseBadge phase={travel.phase} />
          </button>
        ))}
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full rounded-xl"
          onClick={() => setFullscreenOpen(true)}
        >
          {t("travelChooserSearch")}
        </Button>
      </div>

      <div className="hidden space-y-2 sm:block">
        <Input
          value={query}
          placeholder={t("travelChooserSearch")}
          className="h-11 rounded-xl"
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border/50 p-1">
          {items.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              {t("travelChooserEmpty")}
            </p>
          ) : (
            items.map((travel) => (
              <button
                key={travel.id}
                type="button"
                className={cn(
                  "flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-muted/60",
                  value === travel.id && "bg-muted",
                )}
                onClick={() => apply(travel)}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{travel.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatSchedule(travel.startsAt, travel.endsAt)}
                    {travel.placeLabel ? ` · ${travel.placeLabel}` : ""}
                  </p>
                </div>
                <TravelPhaseBadge phase={travel.phase} />
              </button>
            ))
          )}
        </div>
      </div>

      {typeof document !== "undefined" && fullscreenOpen
        ? createPortal(
            <div className="fixed inset-0 z-[100] flex flex-col bg-background sm:hidden">
              <div className="flex items-center gap-2 border-b px-3 py-3">
                <Input
                  autoFocus
                  value={query}
                  placeholder={t("travelChooserSearch")}
                  className="h-12 flex-1 rounded-xl text-base"
                  onChange={(event) => setQuery(event.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="h-12 rounded-xl"
                  onClick={() => setFullscreenOpen(false)}
                >
                  {t("travelChooserClear")}
                </Button>
              </div>
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
                {items.map((travel) => (
                  <button
                    key={travel.id}
                    type="button"
                    className="flex min-h-14 w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-muted/60"
                    onClick={() => apply(travel)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{travel.title}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {formatSchedule(travel.startsAt, travel.endsAt)}
                      </p>
                    </div>
                    <TravelPhaseBadge phase={travel.phase} />
                  </button>
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
