"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { claimEventAttendee } from "@/lib/api/events";
import { cn } from "@/lib/utils";
import { EventAuthorRole } from "@/types/enums";

import { useEventContext } from "./event-context";

const CHIP_COLORS = [
  "bg-emerald-500/25 text-emerald-950 dark:text-emerald-100",
  "bg-sky-500/25 text-sky-950 dark:text-sky-100",
  "bg-violet-500/25 text-violet-950 dark:text-violet-100",
  "bg-amber-500/25 text-amber-950 dark:text-amber-100",
  "bg-rose-500/25 text-rose-950 dark:text-rose-100",
  "bg-cyan-500/25 text-cyan-950 dark:text-cyan-100",
  "bg-orange-500/25 text-orange-950 dark:text-orange-100",
  "bg-lime-500/25 text-lime-950 dark:text-lime-100",
];

function colorForId(id: string): string {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash + id.charCodeAt(index) * (index + 1)) % CHIP_COLORS.length;
  }
  return CHIP_COLORS[hash] ?? CHIP_COLORS[0]!;
}

export function EventGuestClaimDialog() {
  const t = useTranslations("events");
  const { event, viewer, refreshEvent } = useEventContext();
  const needsClaim =
    viewer.role === EventAuthorRole.Guest && viewer.claimedAttendeeId == null;
  const [name, setName] = useState("");
  const [attendeeId, setAttendeeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const attendees = useMemo(() => event.attendees, [event.attendees]);

  if (!needsClaim) {
    return null;
  }

  async function submit() {
    if (!attendeeId || !name.trim()) {
      toast.error(t("guestClaimInvalid"));
      return;
    }
    setSaving(true);
    try {
      await claimEventAttendee(event.id, {
        attendeeId,
        name: name.trim(),
      });
      await refreshEvent();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("guestClaimFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open>
          <DialogContent
            showCloseButton={false}
            className="sm:max-w-md"
          >
        <DialogHeader>
          <DialogTitle>{t("guestClaimTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("guestClaimHint")}
          </p>
          <div className="space-y-2">
            <Label>{t("guestClaimName")}</Label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {attendees.map((attendee) => (
              <button
                key={attendee.id}
                type="button"
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-shadow",
                  colorForId(attendee.id),
                  attendeeId === attendee.id && "ring-2 ring-primary",
                )}
                onClick={() => {
                  setAttendeeId(attendee.id);
                  setName(attendee.name);
                }}
              >
                {attendee.name}
              </button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            disabled={saving || !attendeeId || !name.trim()}
            onClick={() => void submit()}
          >
            {t("guestClaimContinue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
