"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ME_PARTY_ID } from "@/features/transaction-calculator/calculator-session";
import { cn } from "@/lib/utils";

type CalculatorWorkspaceSwitcherProps = {
  readonly activeId: string;
  readonly meLabel: string;
  readonly people: readonly { id: string; name: string }[];
  readonly onSelect: (workspaceId: string) => void;
};

export function CalculatorWorkspaceSwitcher({
  activeId,
  meLabel,
  people,
  onSelect,
}: CalculatorWorkspaceSwitcherProps) {
  return (
    <Tabs className="w-full" value={activeId} onValueChange={onSelect}>
      <TabsList
        className={cn(
          "grid h-auto max-h-28 w-full auto-rows-9 gap-1 overflow-y-auto rounded-xl p-1",
          "grid-cols-[repeat(auto-fit,minmax(min(100%,6.5rem),1fr))]",
          "md:h-auto md:w-full md:rounded-xl md:p-1",
        )}
      >
        <WorkspaceTab value={ME_PARTY_ID} label={meLabel} />
        {people.map((person) => (
          <WorkspaceTab key={person.id} value={person.id} label={person.name} />
        ))}
      </TabsList>
    </Tabs>
  );
}

function WorkspaceTab({
  value,
  label,
}: {
  readonly value: string;
  readonly label: string;
}) {
  return (
    <TabsTrigger
      value={value}
      className="h-9 min-w-0 rounded-xl px-2.5 text-sm font-medium md:min-w-0 md:px-3"
    >
      <span className="truncate">{label}</span>
    </TabsTrigger>
  );
}
