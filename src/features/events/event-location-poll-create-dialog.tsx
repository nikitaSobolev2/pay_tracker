"use client";

import { CalendarIcon, Loader2, Plus, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
import { DateTimePicker } from "@/features/transactions/date-time-picker";
import {
  createEventLocationPoll,
  updateEventLocationPoll,
  type PollOptionBody,
} from "@/lib/api/events";
import type { EventLocationPollDto } from "@/server/services/event-location-poll-service.types";
import { EventPollSelectionMode } from "@/types/enums";

import { useEventContext } from "./event-context";
import { EVENT_CONTROL_CLASS } from "./event-form-controls";
import {
  emptyPollOptionDraft,
  EventLocationPollOptionFields,
  pollOptionToDraft,
  type PollOptionDraft,
} from "./event-location-poll-option-form";

const FOOTER_BUTTON_CLASS =
  "h-12 w-full rounded-xl text-base sm:w-auto md:h-10";

const TOUCH_BUTTON_CLASS =
  "h-12 flex-1 rounded-xl text-base md:h-10 md:flex-none";

export function EventLocationPollCreateDialog({
  open,
  onOpenChange,
  poll = null,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** When set, dialog edits this poll instead of creating. */
  readonly poll?: EventLocationPollDto | null;
}) {
  const t = useTranslations("events");
  const tCommon = useTranslations("common");
  const { event, refreshEvent } = useEventContext();
  const editing = poll != null;
  const [title, setTitle] = useState("");
  const [selectionMode, setSelectionMode] = useState<EventPollSelectionMode>(
    EventPollSelectionMode.Single,
  );
  const [endsAt, setEndsAt] = useState<Date | null>(null);
  const [options, setOptions] = useState<PollOptionDraft[]>([
    emptyPollOptionDraft(),
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (poll) {
      setTitle(poll.title);
      setSelectionMode(poll.selectionMode);
      setEndsAt(poll.endsAt ? new Date(poll.endsAt) : null);
      setOptions(
        poll.options.length > 0
          ? poll.options.map(pollOptionToDraft)
          : [emptyPollOptionDraft()],
      );
      return;
    }
    setTitle("");
    setSelectionMode(EventPollSelectionMode.Single);
    setEndsAt(null);
    setOptions([emptyPollOptionDraft()]);
  }, [open, poll]);

  async function submit() {
    const trimmedTitle = title.trim();
    const prepared = options
      .map(toOptionBody)
      .filter((option): option is PollOptionBody => option != null);
    if (!trimmedTitle || prepared.length === 0) {
      toast.error(t("pollCreateInvalid"));
      return;
    }
    setSaving(true);
    try {
      if (editing && poll) {
        await updateEventLocationPoll(event.id, {
          pollId: poll.id,
          title: trimmedTitle,
          selectionMode,
          endsAt: endsAt ? endsAt.toISOString() : null,
          options: prepared,
        });
      } else {
        await createEventLocationPoll(event.id, {
          title: trimmedTitle,
          selectionMode,
          endsAt: endsAt ? endsAt.toISOString() : null,
          options: prepared,
        });
      }
      await refreshEvent();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : editing
            ? t("pollUpdateFailed")
            : t("pollCreateFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) {
          onOpenChange(next);
        }
      }}
    >
      <ResponsiveDialogContent size="xl" showCloseButton>
        <ResponsiveDialogHeader>
          <ResponsiveDialogHeaderInner>
            <DialogTitle className="text-xl font-semibold tracking-tight">
              {editing ? t("editPoll") : t("makePoll")}
            </DialogTitle>
          </ResponsiveDialogHeaderInner>
          <div className="pb-3" />
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody className="space-y-5">
          <div className="space-y-2">
            <Label>{t("pollTitleField")}</Label>
            <Input
              className={EVENT_CONTROL_CLASS}
              value={title}
              autoFocus
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("pollSelectionMode")}</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                className={TOUCH_BUTTON_CLASS}
                variant={
                  selectionMode === EventPollSelectionMode.Single
                    ? "default"
                    : "outline"
                }
                onClick={() => setSelectionMode(EventPollSelectionMode.Single)}
              >
                {t("pollSingle")}
              </Button>
              <Button
                type="button"
                className={TOUCH_BUTTON_CLASS}
                variant={
                  selectionMode === EventPollSelectionMode.Multiple
                    ? "default"
                    : "outline"
                }
                onClick={() =>
                  setSelectionMode(EventPollSelectionMode.Multiple)
                }
              >
                {t("pollMultiple")}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("pollTimeLimit")}</Label>
            {endsAt ? (
              <div className="flex items-center gap-2">
                <DateTimePicker
                  value={endsAt}
                  onChange={setEndsAt}
                  className="min-w-0 flex-1"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-12 shrink-0 rounded-xl md:size-11"
                  aria-label={t("pollClearTimeLimit")}
                  onClick={() => setEndsAt(null)}
                >
                  <X className="size-5" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className={`${EVENT_CONTROL_CLASS} justify-start gap-2`}
                onClick={() => setEndsAt(new Date())}
              >
                <CalendarIcon className="size-4 text-muted-foreground" />
                {t("pollSetTimeLimit")}
              </Button>
            )}
          </div>

          <div className="min-w-0 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label>{t("pollOptions")}</Label>
              <Button
                type="button"
                variant="outline"
                className="h-11 shrink-0 gap-1.5 rounded-xl text-base md:h-9 md:text-sm"
                onClick={() =>
                  setOptions((current) => [...current, emptyPollOptionDraft()])
                }
              >
                <Plus className="size-4" />
                {t("pollAddOption")}
              </Button>
            </div>
            {options.map((option, index) => (
              <div
                key={option.key}
                className="min-w-0 space-y-3 overflow-hidden rounded-xl border border-border/60 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    #{index + 1}
                  </span>
                  {options.length > 1 ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-11 rounded-xl md:size-9"
                      onClick={() =>
                        setOptions((current) =>
                          current.filter((row) => row.key !== option.key),
                        )
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
                <EventLocationPollOptionFields
                  value={option}
                  onChange={(next) =>
                    setOptions((current) =>
                      current.map((row) =>
                        row.key === option.key ? { ...row, ...next } : row,
                      ),
                    )
                  }
                />
              </div>
            ))}
          </div>
        </ResponsiveDialogBody>

        <ResponsiveDialogFooter>
          <Button
            type="button"
            variant="outline"
            className={FOOTER_BUTTON_CLASS}
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            className={FOOTER_BUTTON_CLASS}
            disabled={saving}
            onClick={() => void submit()}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {tCommon("save")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}

function toOptionBody(draft: PollOptionDraft): PollOptionBody | null {
  const title = draft.title.trim();
  if (!title) {
    return null;
  }
  return {
    id: draft.optionId ?? undefined,
    title,
    link: draft.link.trim() || null,
    address: draft.address.trim() || null,
    latitude: draft.latitude,
    longitude: draft.longitude,
  };
}
