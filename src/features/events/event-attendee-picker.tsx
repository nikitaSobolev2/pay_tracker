"use client";

import { Plus, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createCounterparty,
  listCounterparties,
  type CounterpartyDto,
} from "@/lib/api/counterparties";
import { cn } from "@/lib/utils";

import { EVENT_CONTROL_CLASS } from "./event-form-controls";

export type EventAttendeePickerProps = {
  readonly selectedIds: readonly string[];
  readonly onChange: (selectedIds: string[]) => void;
};

const SUGGESTION_LIMIT = 8;
const CHIP_LIMIT = 12;

export function EventAttendeePicker({
  selectedIds,
  onChange,
}: EventAttendeePickerProps) {
  const t = useTranslations("events");
  const [people, setPeople] = useState<CounterpartyDto[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listCounterparties({ all: true })
      .then((result) => {
        if (!cancelled) {
          setPeople(result.counterparties);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () => people.filter((person) => selectedIds.includes(person.id)),
    [people, selectedIds],
  );

  const matches = useMemo(
    () => matchPeople(people, selectedIds, query),
    [people, selectedIds, query],
  );

  const canCreate =
    query.trim().length > 0 &&
    !people.some(
      (person) => person.name.toLowerCase() === query.trim().toLowerCase(),
    );

  function select(personId: string) {
    onChange([...selectedIds, personId]);
    setQuery("");
    setOpen(false);
  }

  function remove(personId: string) {
    onChange(selectedIds.filter((id) => id !== personId));
  }

  async function createAndSelect() {
    const name = query.trim();
    if (!name) {
      return;
    }
    setCreating(true);
    try {
      const result = await createCounterparty(name);
      setPeople((current) => [...current, result.counterparty]);
      select(result.counterparty.id);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label>{t("attendees")}</Label>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className={cn(EVENT_CONTROL_CLASS, "pl-9")}
          placeholder={t("attendeeSearchPlaceholder")}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        />
        {open && (matches.length > 0 || canCreate) ? (
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border bg-popover p-1 shadow-md">
            {matches.map((person) => (
              <button
                key={person.id}
                type="button"
                className="flex min-h-11 w-full cursor-pointer rounded-lg px-3 py-2.5 text-left text-base hover:bg-accent"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(person.id)}
              >
                {person.name}
              </button>
            ))}
            {canCreate ? (
              <button
                type="button"
                className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-left text-base hover:bg-accent"
                disabled={creating}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void createAndSelect()}
              >
                <Plus className="size-4" />
                {t("attendeeCreate", { name: query.trim() })}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((person) => (
            <Badge
              key={person.id}
              className="h-10 gap-1.5 rounded-full bg-foreground py-1 pr-1.5 pl-3.5 text-sm font-medium text-background"
            >
              {person.name}
              <button
                type="button"
                aria-label={t("attendeeRemove")}
                className="cursor-pointer rounded-full p-1 hover:bg-background/20"
                onClick={() => remove(person.id)}
              >
                <X className="size-3.5" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}

      {matches.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {matches.slice(0, CHIP_LIMIT).map((person) => (
            <button
              key={person.id}
              type="button"
              className="cursor-pointer"
              onClick={() => select(person.id)}
            >
              <Badge
                variant="outline"
                className="h-10 rounded-full px-3.5 text-sm font-medium"
              >
                {person.name}
              </Badge>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function matchPeople(
  people: readonly CounterpartyDto[],
  selectedIds: readonly string[],
  query: string,
): CounterpartyDto[] {
  const normalized = query.trim().toLowerCase();
  return people
    .filter((person) => !selectedIds.includes(person.id))
    .filter(
      (person) => !normalized || person.name.toLowerCase().includes(normalized),
    )
    .slice(0, SUGGESTION_LIMIT);
}
