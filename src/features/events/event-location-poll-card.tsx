"use client";

import { Check, ExternalLink, ImageIcon, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PersonAvatar } from "@/components/person-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BENTO_LABEL_CLASS } from "@/lib/bento";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  addEventLocationPollOption,
  deleteEventLocationPoll,
  deleteEventLocationPollOption,
  finishEventLocationPoll,
  setEventLocationPollVotes,
} from "@/lib/api/events";
import { cn } from "@/lib/utils";
import type {
  EventLocationPollOptionDto,
  EventLocationPollVoterDto,
} from "@/server/services/event-location-poll-service.types";
import {
  EventAuthorRole,
  EventPollSelectionMode,
  EventPollStatus,
} from "@/types/enums";

import { useEventContext } from "./event-context";
import { EventLocationPollCreateDialog } from "./event-location-poll-create-dialog";
import { EventLocationPollOptionFormDialog } from "./event-location-poll-option-form";

export function EventLocationPollCard({
  className,
}: {
  readonly className?: string;
}) {
  const t = useTranslations("events");
  const { event, viewer, refreshEvent } = useEventContext();
  const poll = event.locationPoll;
  const hasLocation = Boolean(event.address ?? event.latitude);
  const isOwner = viewer.role === EventAuthorRole.Owner;
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [optionFormOpen, setOptionFormOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [pickIds, setPickIds] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOwner && poll?.needsOwnerPick) {
      setPickIds([...poll.options.map((option) => option.id)]);
      setPickOpen(true);
    }
  }, [isOwner, poll?.needsOwnerPick, poll?.id, poll?.options]);

  if (!poll && hasLocation) {
    return null;
  }

  if (!poll) {
    return (
      <Card className={cn("flex min-h-96 w-full flex-col", className)}>
        <CardHeader>
          <CardTitle className={BENTO_LABEL_CLASS}>{t("locationPollTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col items-center justify-center space-y-3 text-center">
          <p className="text-sm text-muted-foreground">
            {t("locationUndefined")}
          </p>
          {isOwner ? (
            <Button type="button" onClick={() => setCreateOpen(true)}>
              {t("makePoll")}
            </Button>
          ) : null}
          <EventLocationPollCreateDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
          />
        </CardContent>
      </Card>
    );
  }

  const activePoll = poll;
  const pollIsOpen = activePoll.status === EventPollStatus.Open;
  const votedCount = activePoll.voters.length;
  const totalPeople = Math.max(event.attendees.length, votedCount);

  async function voteFor(optionId: string) {
    if (!pollIsOpen || activePoll.needsOwnerPick) {
      return;
    }
    setBusy(true);
    try {
      const selected = new Set(activePoll.viewerVoteOptionIds);
      if (activePoll.selectionMode === EventPollSelectionMode.Single) {
        if (selected.has(optionId) && selected.size === 1) {
          selected.clear();
        } else {
          selected.clear();
          selected.add(optionId);
        }
      } else if (selected.has(optionId)) {
        selected.delete(optionId);
      } else {
        selected.add(optionId);
      }
      await setEventLocationPollVotes(event.id, {
        pollId: activePoll.id,
        optionIds: [...selected],
      });
      await refreshEvent();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("pollVoteFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function finish(optionId?: string) {
    setBusy(true);
    try {
      const result = await finishEventLocationPoll(event.id, {
        pollId: activePoll.id,
        optionId,
      });
      if (result.kind === "needsPick") {
        setPickIds([...result.optionIds]);
        setPickOpen(true);
      } else {
        setPickOpen(false);
        await refreshEvent();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("pollFinishFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeOption(optionId: string) {
    setBusy(true);
    try {
      await deleteEventLocationPollOption(event.id, optionId, activePoll.id);
      await refreshEvent();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("pollOptionFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function removePoll() {
    setBusy(true);
    try {
      await deleteEventLocationPoll(event.id, { pollId: activePoll.id });
      await refreshEvent();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("pollDeleteFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  const canAddOption =
    isOwner ||
    (pollIsOpen && (viewer.canEdit || viewer.role === EventAuthorRole.Guest));

  return (
    <>
      <div className={cn("poll-rainbow-frame w-full", className)}>
        <Card className="flex min-h-96 w-full flex-col ring-0">
          <CardHeader className="relative space-y-1 text-center">
            <CardTitle className="text-2xl font-semibold tracking-tight lg:px-16 sm:text-3xl">
              {activePoll.title}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {activePoll.status === EventPollStatus.Finished
                ? t("pollFinished")
                : activePoll.selectionMode === EventPollSelectionMode.Multiple
                  ? t("pollMultiple")
                  : t("pollSingle")}
            </p>
            {isOwner ? (
              <div className="absolute top-0 right-4 hidden flex-wrap items-center justify-end gap-1.5 lg:flex">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={busy}
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="size-3.5" />
                  {t("editPoll")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  disabled={busy}
                  onClick={() => void removePoll()}
                >
                  <Trash2 className="size-3.5" />
                  {t("deletePoll")}
                </Button>
                {pollIsOpen ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => void finish()}
                  >
                    {t("finishPoll")}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </CardHeader>

          <CardContent className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="flex min-h-0 flex-col space-y-3 lg:col-span-2">
              <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                {activePoll.options.map((option) => (
                  <PollOptionRow
                    key={option.id}
                    option={option}
                    voted={activePoll.viewerVoteOptionIds.includes(option.id)}
                    disabled={busy || !pollIsOpen || activePoll.needsOwnerPick}
                    canDelete={
                      isOwner ||
                      (pollIsOpen &&
                        viewer.guestUserId != null &&
                        option.authorGuestId === viewer.guestUserId)
                    }
                    onVote={() => void voteFor(option.id)}
                    onDelete={() => void removeOption(option.id)}
                    onImage={(url) => setImageUrl(url)}
                  />
                ))}
              </ul>

              {canAddOption ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 sm:w-auto sm:self-start"
                  onClick={() => setOptionFormOpen(true)}
                >
                  <Plus className="size-3.5" />
                  {t("pollAddOption")}
                </Button>
              ) : null}
            </div>

            <PollSidePanel
              endsAt={activePoll.endsAt}
              status={activePoll.status}
              voters={activePoll.voters}
              options={activePoll.options}
              votedCount={votedCount}
              totalPeople={totalPeople}
            />
          </CardContent>

          {isOwner ? (
            <div className="flex flex-col gap-2 px-4 pb-4 lg:hidden">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full gap-1.5"
                disabled={busy}
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="size-3.5" />
                {t("editPoll")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full gap-1.5 text-destructive hover:text-destructive"
                disabled={busy}
                onClick={() => void removePoll()}
              >
                <Trash2 className="size-3.5" />
                {t("deletePoll")}
              </Button>
              {pollIsOpen ? (
                <Button
                  type="button"
                  className="h-11 w-full"
                  disabled={busy}
                  onClick={() => void finish()}
                >
                  {t("finishPoll")}
                </Button>
              ) : null}
            </div>
          ) : null}
        </Card>
      </div>

      <EventLocationPollCreateDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        poll={activePoll}
      />
      <EventLocationPollOptionFormDialog
        open={optionFormOpen}
        onOpenChange={setOptionFormOpen}
        onSubmit={async (option) => {
          await addEventLocationPollOption(event.id, {
            pollId: activePoll.id,
            option,
          });
          await refreshEvent();
        }}
      />

      <Dialog open={pickOpen} onOpenChange={setPickOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("pollPickWinner")}</DialogTitle>
          </DialogHeader>
          <ul className="space-y-2">
            {activePoll.options
              .filter((option) => pickIds.includes(option.id))
              .map((option) => (
                <li key={option.id}>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start"
                    disabled={busy}
                    onClick={() => void finish(option.id)}
                  >
                    {option.title}
                  </Button>
                </li>
              ))}
          </ul>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(imageUrl)} onOpenChange={() => setImageUrl(null)}>
        <DialogContent className="max-w-3xl p-2">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              className="max-h-[80vh] w-full rounded-lg object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function PollSidePanel({
  endsAt,
  status,
  voters,
  options,
  votedCount,
  totalPeople,
}: {
  readonly endsAt: string | null;
  readonly status: EventPollStatus;
  readonly voters: readonly EventLocationPollVoterDto[];
  readonly options: readonly EventLocationPollOptionDto[];
  readonly votedCount: number;
  readonly totalPeople: number;
}) {
  const t = useTranslations("events");

  return (
    <aside className="flex min-h-0 flex-col items-center justify-center rounded-xl border border-border/60 bg-muted/20 p-4 text-center lg:border-l lg:border-t-0">
      <div className="flex w-full max-w-xs flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("pollCountdown")}
          </p>
          <PollCountdown endsAt={endsAt} status={status} />
        </div>

        <div className="flex w-full min-h-0 flex-col items-center gap-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("pollVotedLabel")}
          </p>
          <p className="text-3xl font-semibold tabular-nums tracking-tight">
            {t("pollVotedProgress", {
              voted: votedCount,
              total: totalPeople,
            })}
          </p>
          {voters.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("pollVotersEmpty")}
            </p>
          ) : (
            <ul className="mt-1 max-h-48 w-full space-y-2 overflow-y-auto">
              {voters.map((voter) => (
                <li
                  key={voter.key}
                  className="flex items-center justify-center gap-2"
                >
                  <PersonAvatar
                    seed={voter.key}
                    name={voter.name}
                    size="sm"
                  />
                  <div className="min-w-0 text-left">
                    <p className="truncate text-sm font-medium">{voter.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {voter.optionIds
                        .map(
                          (id) =>
                            options.find((option) => option.id === id)
                              ?.title ?? id,
                        )
                        .join(", ")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}

function PollCountdown({
  endsAt,
  status,
}: {
  readonly endsAt: string | null;
  readonly status: EventPollStatus;
}) {
  const t = useTranslations("events");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!endsAt || status !== EventPollStatus.Open) {
      return;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [endsAt, status]);

  if (status === EventPollStatus.Finished) {
    return (
      <p className="text-center text-2xl font-semibold tracking-tight">
        {t("pollFinished")}
      </p>
    );
  }
  if (!endsAt) {
    return (
      <p className="text-center text-2xl font-semibold tracking-tight text-muted-foreground">
        {t("pollNoDeadline")}
      </p>
    );
  }

  const remainingMs = new Date(endsAt).getTime() - now;
  if (remainingMs <= 0) {
    return (
      <p className="text-center text-2xl font-semibold tracking-tight">
        {t("pollVotingEnded")}
      </p>
    );
  }

  const parts = splitCountdown(remainingMs);
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {parts.map((part) => (
        <div
          key={part.label}
          className="min-w-14 rounded-lg bg-background/80 px-2 py-1.5 text-center ring-1 ring-border/60"
        >
          <p className="text-xl font-semibold tabular-nums leading-none">
            {part.value}
          </p>
          <p className="mt-1 text-[10px] tracking-wide text-muted-foreground uppercase">
            {part.label}
          </p>
        </div>
      ))}
    </div>
  );
}

function splitCountdown(ms: number): readonly { label: string; value: string }[] {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  if (days > 0) {
    return [
      { label: "d", value: String(days) },
      { label: "h", value: pad(hours) },
      { label: "m", value: pad(minutes) },
      { label: "s", value: pad(seconds) },
    ];
  }
  return [
    { label: "h", value: pad(hours) },
    { label: "m", value: pad(minutes) },
    { label: "s", value: pad(seconds) },
  ];
}

function PollOptionRow({
  option,
  voted,
  disabled,
  canDelete,
  onVote,
  onDelete,
  onImage,
}: {
  readonly option: EventLocationPollOptionDto;
  readonly voted: boolean;
  readonly disabled: boolean;
  readonly canDelete: boolean;
  readonly onVote: () => void;
  readonly onDelete: () => void;
  readonly onImage: (url: string) => void;
}) {
  const t = useTranslations("events");
  const [imageBroken, setImageBroken] = useState(false);
  const showImage = Boolean(option.imageUrl) && !imageBroken;

  useEffect(() => {
    setImageBroken(false);
  }, [option.imageUrl]);

  return (
    <div
      className={cn(
        "relative flex overflow-hidden rounded-xl border border-border/60 bg-muted/40",
        voted && "ring-1 ring-primary",
      )}
    >
      <div
        className="absolute inset-y-0 left-0 bg-primary/20 transition-[width]"
        style={{ width: `${Math.min(100, option.percent)}%` }}
        aria-hidden
      />
      <div className="relative flex min-w-0 flex-1 items-center gap-3 p-3">
        {showImage ? (
          <button
            type="button"
            className="size-12 shrink-0 overflow-hidden rounded-lg bg-background"
            onClick={() => onImage(option.imageUrl!)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={option.imageUrl!}
              alt=""
              className="size-full object-cover"
              onError={() => setImageBroken(true)}
            />
          </button>
        ) : (
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-background/80 text-muted-foreground ring-1 ring-border/50"
            aria-hidden
          >
            <ImageIcon className="size-5 opacity-60" />
          </div>
        )}
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          disabled={disabled}
          onClick={onVote}
        >
          <p className="truncate font-medium">{option.title}</p>
        </button>
        <div className="flex shrink-0 items-center gap-2 text-sm tabular-nums">
          {voted ? <Check className="size-4 text-primary" /> : null}
          <span>
            {option.voteCount} · {option.percent.toFixed(0)}%
          </span>
          {canDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={onDelete}
            >
              <Trash2 className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </div>
      {option.link ? (
        <a
          href={option.link}
          target="_blank"
          rel="noopener noreferrer"
          className="relative flex size-[4.5rem] shrink-0 grow-0 basis-[4.5rem] items-center justify-center border-l border-border/60 bg-background/50 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          aria-label={t("pollOptionLinkChip")}
          onClick={(clickEvent) => clickEvent.stopPropagation()}
        >
          <ExternalLink className="size-4" />
        </a>
      ) : null}
    </div>
  );
}
