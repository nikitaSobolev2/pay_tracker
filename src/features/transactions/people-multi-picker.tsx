"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createCounterparty,
  listCounterparties,
  type CounterpartyDto,
} from "@/lib/api/counterparties";
import { FIELD_CLASS } from "@/lib/bento";
import { cn } from "@/lib/utils";

export type SelectedPerson = {
  readonly id: string;
  readonly name: string;
};

type PeopleMultiPickerProps = {
  readonly selected: readonly SelectedPerson[];
  readonly onChange: (selected: SelectedPerson[]) => void;
};

export function PeopleMultiPicker({
  selected,
  onChange,
}: PeopleMultiPickerProps) {
  const t = useTranslations("transaction");
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<CounterpartyDto[]>([]);
  const [creating, setCreating] = useState(false);
  const selectedIds = useMemo(
    () => new Set(selected.map((person) => person.id)),
    [selected],
  );
  const trimmedName = query.trim();
  const canCreate = trimmedName.length > 0;

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

  function addPerson(person: SelectedPerson) {
    if (selectedIds.has(person.id)) {
      setQuery("");
      return;
    }
    const alreadyNamed = selected.some(
      (item) => item.name.toLowerCase() === person.name.toLowerCase(),
    );
    if (alreadyNamed) {
      setQuery("");
      return;
    }
    onChange([...selected, person]);
    setQuery("");
  }

  function togglePerson(person: CounterpartyDto) {
    if (selectedIds.has(person.id)) {
      onChange(selected.filter((item) => item.id !== person.id));
      return;
    }
    addPerson(person);
  }

  function findPersonByName(name: string): SelectedPerson | undefined {
    const needle = name.toLowerCase();
    return (
      people.find((person) => person.name.toLowerCase() === needle) ??
      selected.find((person) => person.name.toLowerCase() === needle)
    );
  }

  function rememberPerson(person: SelectedPerson) {
    setPeople((current) => {
      if (current.some((item) => item.id === person.id)) {
        return current;
      }
      return [...current, person].sort((left, right) =>
        left.name.localeCompare(right.name),
      );
    });
  }

  async function selectExistingByName(name: string) {
    const listed = await listCounterparties({ all: true, q: name }).catch(
      () => ({ counterparties: people }),
    );
    const match = listed.counterparties.find(
      (person) => person.name.toLowerCase() === name.toLowerCase(),
    );
    if (!match) {
      return;
    }
    rememberPerson(match);
    addPerson(match);
  }

  async function createAndSelect() {
    if (!canCreate || creating) {
      return;
    }
    const existing = findPersonByName(trimmedName);
    if (existing) {
      addPerson(existing);
      return;
    }
    setCreating(true);
    try {
      const result = await createCounterparty(trimmedName);
      rememberPerson(result.counterparty);
      addPerson(result.counterparty);
    } catch {
      await selectExistingByName(trimmedName);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          className={FIELD_CLASS}
          value={query}
          placeholder={t("peoplePlaceholder")}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") {
              return;
            }
            event.preventDefault();
            void createAndSelect();
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="h-11 shrink-0 rounded-xl px-3"
          disabled={!canCreate || creating}
          aria-label={t("createPerson", { name: trimmedName || "—" })}
          onClick={() => void createAndSelect()}
        >
          <Plus className="size-4" />
        </Button>
      </div>

      {people.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {people.map((person) => {
            const active = selectedIds.has(person.id);
            return (
              <button
                key={person.id}
                type="button"
                className="cursor-pointer"
                onClick={() => togglePerson(person)}
              >
                <Badge
                  variant={active ? "default" : "outline"}
                  className={cn(
                    "h-10 rounded-full px-3.5 text-sm font-medium",
                    active && "bg-foreground text-background",
                  )}
                >
                  {person.name}
                </Badge>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
