"use client";

import {
  Check,
  MessageCircle,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  applyEventSuggestion,
  createEventComment,
  createEventThread,
  deleteEventComment,
  listEventThreads,
  setEventThreadResolved,
} from "@/lib/api/events";
import { formatMoney, toDecimal } from "@/lib/money";
import { cn } from "@/lib/utils";
import type {
  EventCommentDto,
  EventThreadDto,
} from "@/server/services/event-thread-service";
import { EventSpendingField } from "@/types/enums";

import {
  AI_RAINBOW_BORDER_CLASS,
  AI_RAINBOW_BORDER_STYLE,
  AI_RAINBOW_FILL_CLASS,
} from "./ai/ai-styles";
import { useEventContext } from "./event-context";
import { MessageComposer } from "./message-composer";
import { MessageImageBubble } from "./message-image-bubble";

export type EventSpendingThreadsProps = {
  readonly spendingId: string;
  readonly openCount: number;
};

export function EventSpendingThreads({
  spendingId,
  openCount,
}: EventSpendingThreadsProps) {
  const t = useTranslations("events");
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const triggerFace = (
    <>
      <MessageCircle className="size-4" />
      {openCount > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
          {openCount}
        </span>
      ) : null}
    </>
  );
  const triggerClassName = "relative size-8 rounded-lg";

  if (isMobile) {
    return (
      <>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={triggerClassName}
          aria-label={t("threads")}
          onClick={() => setOpen(true)}
        >
          {triggerFace}
        </Button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="h-[70vh]">
            <SheetHeader>
              <SheetTitle>{t("threads")}</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-4 pb-6">
              <ThreadsPanel spendingId={spendingId} active={open} />
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={triggerClassName}
            aria-label={t("threads")}
          />
        }
      >
        {triggerFace}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 max-w-[92vw]">
        <ThreadsPanel spendingId={spendingId} active={open} />
      </PopoverContent>
    </Popover>
  );
}

function ThreadsPanel({
  spendingId,
  active,
}: {
  readonly spendingId: string;
  readonly active: boolean;
}) {
  const t = useTranslations("events");
  const { event } = useEventContext();
  const [threads, setThreads] = useState<EventThreadDto[]>([]);
  const [showResolved, setShowResolved] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchThreads = useCallback(
    () => listEventThreads(event.id, spendingId),
    [event.id, spendingId],
  );

  const reload = useCallback(async () => {
    try {
      setThreads((await fetchThreads()).threads);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("threadFailed"));
    }
  }, [fetchThreads, t]);

  useEffect(() => {
    if (!active) {
      return;
    }
    let cancelled = false;
    fetchThreads()
      .then((result) => {
        if (!cancelled) {
          setThreads(result.threads);
        }
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : t("threadFailed"));
      });
    return () => {
      cancelled = true;
    };
  }, [active, fetchThreads, t]);

  async function startThread(payload: {
    body: string;
    imageUrl: string | null;
  }) {
    setBusy(true);
    try {
      const result = await createEventThread(event.id, {
        spendingId,
        body: payload.body,
        imageUrl: payload.imageUrl,
      });
      setThreads(result.threads);
      setDraft("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("threadFailed"));
      throw error;
    } finally {
      setBusy(false);
    }
  }

  const visibleThreads = showResolved
    ? threads
    : threads.filter((thread) => !thread.resolved);
  const resolvedCount = threads.filter((thread) => thread.resolved).length;

  return (
    <div className="space-y-3">
      {visibleThreads.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("threadsEmpty")}</p>
      ) : (
        <ul className="max-h-72 space-y-3 overflow-y-auto">
          {visibleThreads.map((thread) => (
            <li key={thread.id}>
              <ThreadCard thread={thread} onChanged={reload} />
            </li>
          ))}
        </ul>
      )}

      {resolvedCount > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-full rounded-lg text-xs"
          onClick={() => setShowResolved((current) => !current)}
        >
          {showResolved
            ? t("threadsHideResolved")
            : t("threadsShowResolved", { count: resolvedCount })}
        </Button>
      ) : null}

      <MessageComposer
        eventId={event.id}
        value={draft}
        placeholder={t("threadNewPlaceholder")}
        disabled={busy}
        sendLabel={t("chatSend")}
        attachLabel={t("attachImage")}
        onChange={setDraft}
        onSubmit={startThread}
      />
    </div>
  );
}

function ThreadCard({
  thread,
  onChanged,
}: {
  readonly thread: EventThreadDto;
  readonly onChanged: () => Promise<void>;
}) {
  const t = useTranslations("events");
  const { event } = useEventContext();
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("threadFailed"));
      throw error;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "space-y-2 rounded-xl border border-border/60 bg-card/40 p-2.5",
        thread.resolved && "opacity-60",
      )}
    >
      <div className="space-y-2">
        {thread.comments.map((comment) =>
          comment.isAi ? (
            <AiSuggestionComment
              key={comment.id}
              threadId={thread.id}
              spendingId={thread.spendingId}
              comment={comment}
              busy={busy}
              onChanged={onChanged}
              onBusy={setBusy}
            />
          ) : (
            <div key={comment.id} className="group/comment space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium">
                  {comment.author.name}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(comment.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {comment.canDelete ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6 rounded-md opacity-0 group-hover/comment:opacity-100"
                      aria-label={t("threadDelete")}
                      disabled={busy}
                      onClick={() =>
                        void run(() =>
                          deleteEventComment(event.id, thread.id, comment.id),
                        )
                      }
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  ) : null}
                </div>
              </div>
              {comment.imageUrl ? (
                <MessageImageBubble
                  imageUrl={comment.imageUrl}
                  className="max-w-full"
                />
              ) : (
                <p className="text-sm">{comment.body}</p>
              )}
            </div>
          ),
        )}
      </div>

      <div className="flex items-end gap-2">
        <MessageComposer
          eventId={event.id}
          value={reply}
          placeholder={t("threadReplyPlaceholder")}
          disabled={busy}
          className="min-w-0 flex-1"
          sendLabel={t("chatSend")}
          attachLabel={t("attachImage")}
          onChange={setReply}
          onSubmit={async ({ body, imageUrl }) => {
            await run(() =>
              createEventComment(event.id, thread.id, { body, imageUrl }),
            );
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mb-0 size-9 shrink-0 self-end rounded-lg"
          aria-label={thread.resolved ? t("threadReopen") : t("threadResolve")}
          disabled={busy}
          onClick={() =>
            void run(() =>
              setEventThreadResolved(event.id, thread.id, !thread.resolved),
            ).catch(() => undefined)
          }
        >
          {thread.resolved ? (
            <Undo2 className="size-4" />
          ) : (
            <Check className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

function AiSuggestionComment({
  threadId,
  spendingId,
  comment,
  busy,
  onChanged,
  onBusy,
}: {
  readonly threadId: string;
  readonly spendingId: string;
  readonly comment: EventCommentDto;
  readonly busy: boolean;
  readonly onChanged: () => Promise<void>;
  readonly onBusy: (busy: boolean) => void;
}) {
  const t = useTranslations("events");
  const { event, refreshEvent } = useEventContext();
  const spending = event.spendings.find((item) => item.id === spendingId);
  const showApplyAmount =
    comment.canApply &&
    Boolean(comment.suggestedAmount) &&
    !comment.amountApplied &&
    !sameMoney(comment.suggestedAmount, spending?.amount);
  const showApplyPrice =
    comment.canApply &&
    Boolean(comment.suggestedPrice) &&
    !comment.priceApplied &&
    !sameMoney(comment.suggestedPrice, spending?.price);

  async function apply(field: EventSpendingField) {
    onBusy(true);
    try {
      await applyEventSuggestion(event.id, threadId, comment.id, field);
      await refreshEvent();
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("aiApplyFailed"));
    } finally {
      onBusy(false);
    }
  }

  return (
    <div
      className={AI_RAINBOW_BORDER_CLASS}
      style={AI_RAINBOW_BORDER_STYLE}
    >
      <div className={cn(AI_RAINBOW_FILL_CLASS, "space-y-2 p-2.5")}>
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-fuchsia-400">
            <Sparkles className="size-3.5 shrink-0" />
            {t("aiAuthor")}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {new Date(comment.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <p className="text-sm">{comment.body}</p>
        {showApplyAmount || showApplyPrice ? (
          <div className="flex flex-wrap gap-2">
            {showApplyAmount ? (
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-lg border-0 text-xs text-white"
                style={{ backgroundImage: AI_RAINBOW_BORDER_STYLE.backgroundImage }}
                disabled={busy}
                onClick={() => void apply(EventSpendingField.Amount)}
              >
                {t("aiApplyAmount", {
                  value: comment.suggestedAmount ?? "",
                })}
              </Button>
            ) : null}
            {showApplyPrice ? (
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-lg border-0 text-xs text-white"
                style={{ backgroundImage: AI_RAINBOW_BORDER_STYLE.backgroundImage }}
                disabled={busy}
                onClick={() => void apply(EventSpendingField.Price)}
              >
                {t("aiApplyPrice", {
                  value: formatMoney(
                    comment.suggestedPrice ?? "0",
                    event.currency,
                  ),
                })}
              </Button>
            ) : null}
          </div>
        ) : null}
        {(comment.amountApplied || comment.priceApplied) &&
        !showApplyAmount &&
        !showApplyPrice ? (
          <p className="text-xs text-muted-foreground">{t("aiApplied")}</p>
        ) : null}
      </div>
    </div>
  );
}

function sameMoney(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  if (left == null || right == null) {
    return false;
  }
  return toDecimal(left).eq(toDecimal(right));
}
