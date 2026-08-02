"use client";

import { Check, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { renameGuest, updateEvent } from "@/lib/api/events";
import { cn } from "@/lib/utils";
import type { EventPresenceViewerDto } from "@/server/services/event-live-service";
import { EventAuthorRole } from "@/types/enums";

import { useEventContext } from "./event-context";

export type EventPresenceBarProps = {
  readonly viewers: readonly EventPresenceViewerDto[];
  readonly onRenamed: () => Promise<void>;
};

const MAX_VISIBLE_AVATARS = 5;

export function EventPresenceBar({
  viewers,
  onRenamed,
}: EventPresenceBarProps) {
  const t = useTranslations("events");
  const { viewer } = useEventContext();
  const visible = viewers.slice(0, MAX_VISIBLE_AVATARS);
  const overflow = viewers.length - visible.length;

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {visible.map((person) => (
          <Tooltip key={person.id}>
            <TooltipTrigger
              render={
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full border-2 border-background text-xs font-semibold",
                    person.isOwner
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                  )}
                />
              }
            >
              {initialsOf(person.name)}
            </TooltipTrigger>
            <TooltipContent>{person.name}</TooltipContent>
          </Tooltip>
        ))}
        {overflow > 0 ? (
          <span className="flex size-8 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-semibold">
            +{overflow}
          </span>
        ) : null}
      </div>
      <RenameControl label={t("renameMe")} onRenamed={onRenamed} />
      {viewer.role === EventAuthorRole.Guest ? (
        <span className="text-xs text-muted-foreground max-sm:hidden">
          {viewer.displayName}
        </span>
      ) : null}
    </div>
  );
}

function RenameControl({
  label,
  onRenamed,
}: {
  readonly label: string;
  readonly onRenamed: () => Promise<void>;
}) {
  const t = useTranslations("events");
  const { event, viewer, refreshEvent } = useEventContext();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(viewer.displayName);
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    setSaving(true);
    try {
      if (viewer.role === EventAuthorRole.Owner) {
        await updateEvent(event.id, { ownerDisplayName: trimmed });
        await refreshEvent();
      } else {
        await renameGuest(trimmed);
      }
      await onRenamed();
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("renameFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-full"
            aria-label={label}
          >
            <Pencil className="size-3.5" />
          </Button>
        }
      />
      <PopoverContent className="w-64 space-y-2" align="end">
        <p className="text-sm font-medium">{label}</p>
        <div className="flex gap-2">
          <Input
            className="h-9 rounded-lg"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void save();
              }
            }}
          />
          <Button
            type="button"
            size="icon"
            className="size-9 shrink-0 rounded-lg"
            disabled={saving || !name.trim()}
            onClick={() => void save()}
          >
            <Check className="size-4" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "?";
}
