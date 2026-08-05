"use client";

import {
  Check,
  CheckCircle2,
  ChevronDown,
  Pencil,
  Plus,
  Trash2,
  UserMinus,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  addEventAttendee,
  createEventPayment,
  deleteEventPayment,
  removeEventAttendee,
  updateEventAttendee,
  updateEventPayment,
} from "@/lib/api/events";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type {
  EventAttendeeDto,
  EventPaymentDto,
} from "@/server/services/event-service.types";
import { EventAttendanceStatus, EventAuthorRole } from "@/types/enums";

import { useEventContext } from "./event-context";

/** Single People card: attendees, payments per person, collected + unpaid summary. */
export function EventPeoplePanel({
  className,
}: {
  readonly className?: string;
}) {
  const t = useTranslations("events");
  const { event, viewer, refreshEvent } = useEventContext();
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const balanceByAttendee = useMemo(() => {
    const map = new Map(
      event.summary.balances.map((balance) => [balance.attendeeId, balance]),
    );
    return map;
  }, [event.summary.balances]);

  const paymentsByAttendee = useMemo(() => {
    const map = new Map<string, EventPaymentDto[]>();
    for (const payment of event.payments) {
      const current = map.get(payment.attendeeId) ?? [];
      current.push(payment);
      map.set(payment.attendeeId, current);
    }
    return map;
  }, [event.payments]);

  const unpaid = event.summary.balances.filter(
    (balance) => !balance.hasPaidShare,
  );

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      await refreshEvent();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("attendeeFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function addByName() {
    const name = newName.trim();
    if (!name) {
      return;
    }
    await run(() => addEventAttendee(event.id, { name }));
    setNewName("");
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{t("attendeesTitle")}</CardTitle>
        <CardAction>
          <span className="text-sm text-muted-foreground tabular-nums">
            {event.attendees.length}
          </span>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        {event.attendees.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("attendeesEmpty")}</p>
        ) : (
          <ul className="divide-y divide-border/50 rounded-xl border border-border/60">
            {event.attendees.map((attendee) => {
              const balance = balanceByAttendee.get(attendee.id);
              const payments = paymentsByAttendee.get(attendee.id) ?? [];
              const canRemove =
                viewer.role === EventAuthorRole.Owner ||
                (viewer.guestUserId != null &&
                  attendee.authorGuestId === viewer.guestUserId);
              return (
                <PersonRow
                  key={attendee.id}
                  attendee={attendee}
                  paid={balance?.paid ?? "0"}
                  hasPaidShare={balance?.hasPaidShare ?? false}
                  payments={payments}
                  busy={busy}
                  canEdit={viewer.canEdit}
                  canManagePayments={viewer.canManagePayments}
                  canRemove={canRemove}
                  onToggleStatus={(status) =>
                    void run(() =>
                      updateEventAttendee(event.id, attendee.id, status),
                    )
                  }
                  onRemove={() =>
                    void run(() => removeEventAttendee(event.id, attendee.id))
                  }
                />
              );
            })}
          </ul>
        )}

        {viewer.canEdit || viewer.role === EventAuthorRole.Guest ? (
          <div className="flex items-center gap-2">
            <Input
              className="h-10 rounded-xl"
              placeholder={t("attendeeAddPlaceholder")}
              value={newName}
              disabled={busy}
              onChange={(changeEvent) => setNewName(changeEvent.target.value)}
              onKeyDown={(keyEvent) => {
                if (keyEvent.key === "Enter") {
                  keyEvent.preventDefault();
                  void addByName();
                }
              }}
            />
            <Button
              type="button"
              size="icon"
              className="size-10 shrink-0 rounded-xl"
              aria-label={t("attendeeAdd")}
              disabled={busy || !newName.trim()}
              onClick={() => void addByName()}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        ) : null}

        <div className="space-y-3 border-t border-border/60 pt-4">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-3">
            <span className="text-sm text-muted-foreground">{t("collected")}</span>
            <span className="text-base font-semibold tabular-nums">
              {formatMoney(event.summary.paidProgress.collected, event.currency)}
            </span>
          </div>

          {unpaid.length > 0 ? (
            <div className="space-y-2 rounded-xl border border-border/60 px-3 py-3">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {t("paymentsUnpaidTitle")}
              </p>
              <ul className="divide-y divide-border/40">
                {unpaid.map((balance) => (
                  <li
                    key={balance.attendeeId}
                    className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0"
                  >
                    <span className="min-w-0 truncate">{balance.name}</span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {t("paymentsOwes", {
                        amount: formatMoney(balance.remaining, event.currency),
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function PersonRow({
  attendee,
  paid,
  hasPaidShare,
  payments,
  busy,
  canEdit,
  canManagePayments,
  canRemove,
  onToggleStatus,
  onRemove,
}: {
  readonly attendee: EventAttendeeDto;
  readonly paid: string;
  readonly hasPaidShare: boolean;
  readonly payments: readonly EventPaymentDto[];
  readonly busy: boolean;
  readonly canEdit: boolean;
  readonly canManagePayments: boolean;
  readonly canRemove: boolean;
  readonly onToggleStatus: (status: EventAttendanceStatus) => void;
  readonly onRemove: () => void;
}) {
  const t = useTranslations("events");
  const { event } = useEventContext();
  const [expanded, setExpanded] = useState(false);
  const hasPayments = payments.length > 0;
  const paidAmount = Number(paid);

  return (
    <li
      className={cn(
        "px-3 py-2.5 first:rounded-t-xl last:rounded-b-xl",
        hasPaidShare && "bg-emerald-500/5",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {/* Same width for every row so names stay aligned when some have no payments. */}
        <div className="flex size-8 shrink-0 items-center justify-center">
          {canManagePayments && hasPayments ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg"
              aria-label={t("paymentsHistory")}
              aria-expanded={expanded}
              onClick={() => setExpanded((current) => !current)}
            >
              <ChevronDown
                className={cn(
                  "size-4 transition-transform",
                  expanded && "rotate-180",
                )}
              />
            </Button>
          ) : null}
        </div>
        <span className="min-w-0 flex-1 truncate font-medium">
          {attendee.name}
        </span>
        {hasPaidShare ? (
          <CheckCircle2
            className="size-4 shrink-0 text-emerald-400"
            aria-label={t("paidUp")}
          />
        ) : null}
        {paidAmount > 0 ? (
          <span className="shrink-0 text-sm font-semibold tabular-nums">
            {formatMoney(paid, event.currency)}
          </span>
        ) : null}
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <StatusToggle
            attendee={attendee}
            disabled={busy || !canEdit}
            onToggle={onToggleStatus}
          />
          {canManagePayments ? (
            <AddPaymentButton attendeeId={attendee.id} />
          ) : null}
          {canRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg text-destructive"
              aria-label={t("attendeeRemove")}
              disabled={busy}
              onClick={onRemove}
            >
              <UserMinus className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>

      {canManagePayments && expanded && hasPayments ? (
        <ul className="mt-2 space-y-1 border-l border-border/60 pl-3 ml-8">
          {payments.map((payment) => (
            <PaymentRow key={payment.id} payment={payment} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function StatusToggle({
  attendee,
  disabled,
  onToggle,
}: {
  readonly attendee: EventAttendeeDto;
  readonly disabled: boolean;
  readonly onToggle: (status: EventAttendanceStatus) => void;
}) {
  const t = useTranslations("events");
  const isCertain = attendee.status === EventAttendanceStatus.Certain;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        "h-8 rounded-full text-xs",
        isCertain
          ? "border-emerald-500/40 text-emerald-400"
          : "border-amber-500/40 text-amber-400",
      )}
      disabled={disabled}
      onClick={() =>
        onToggle(
          isCertain
            ? EventAttendanceStatus.Uncertain
            : EventAttendanceStatus.Certain,
        )
      }
    >
      {isCertain ? t("statusCertain") : t("statusUncertain")}
    </Button>
  );
}

function PaymentRow({ payment }: { readonly payment: EventPaymentDto }) {
  const t = useTranslations("events");
  const tCommon = useTranslations("common");
  const { event, applySettlement } = useEventContext();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(payment.amount);
  const [rowBusy, setRowBusy] = useState(false);

  async function run(
    action: () => Promise<Parameters<typeof applySettlement>[0]>,
  ) {
    setRowBusy(true);
    try {
      applySettlement(await action());
      setEditing(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("paymentFailed"));
    } finally {
      setRowBusy(false);
    }
  }

  return (
    <li className="flex items-center gap-2 text-sm">
      <span className="text-xs text-muted-foreground">
        {new Date(payment.paidAt).toLocaleDateString()}
      </span>
      {editing ? (
        <Input
          inputMode="numeric"
          className="h-9 w-24 rounded-lg"
          value={amount}
          onChange={(changeEvent) =>
            setAmount(changeEvent.target.value.replace(/\D/g, ""))
          }
        />
      ) : (
        <span className="flex-1 tabular-nums">
          {formatMoney(payment.amount, event.currency)}
        </span>
      )}

      <div className="ml-auto flex items-center gap-1">
        {editing ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg"
              aria-label={tCommon("save")}
              disabled={rowBusy || !amount}
              onClick={() =>
                void run(() =>
                  updateEventPayment(event.id, payment.id, amount.trim()),
                )
              }
            >
              <Check className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg"
              aria-label={tCommon("cancel")}
              disabled={rowBusy}
              onClick={() => {
                setAmount(payment.amount);
                setEditing(false);
              }}
            >
              <X className="size-4" />
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-lg"
            aria-label={tCommon("edit")}
            onClick={() => setEditing(true)}
          >
            <Pencil className="size-4" />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-lg text-destructive"
          aria-label={tCommon("delete")}
          disabled={rowBusy}
          onClick={() =>
            void run(() => deleteEventPayment(event.id, payment.id))
          }
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  );
}

function roundUpToWhole(amount: string): string {
  const parsed = Number(amount);
  return Number.isFinite(parsed) ? String(Math.ceil(parsed)) : "0";
}

function toWholeDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function AddPaymentButton({ attendeeId }: { readonly attendeeId: string }) {
  const t = useTranslations("events");
  const { event, applySettlement } = useEventContext();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(() =>
    roundUpToWhole(event.summary.share.average),
  );
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const settlement = await createEventPayment(event.id, {
        attendeeId,
        amount: amount.trim(),
      });
      applySettlement(settlement);
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("paymentFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setAmount(roundUpToWhole(event.summary.share.average));
        }
      }}
    >
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 shrink-0 gap-1 rounded-full px-2.5 text-xs"
          />
        }
      >
        <Plus className="size-3.5" />
        {t("addSum")}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-2">
        <p className="text-sm font-medium">{t("addSumTitle")}</p>
        <p className="text-xs text-muted-foreground">
          {t("addSumHint", {
            amount: formatMoney(event.summary.share.average, event.currency),
          })}
        </p>
        <div className="flex gap-2">
          <Input
            inputMode="numeric"
            className="h-9 rounded-lg"
            value={amount}
            onChange={(changeEvent) =>
              setAmount(toWholeDigits(changeEvent.target.value))
            }
          />
          <Button
            type="button"
            className="h-9 shrink-0 rounded-lg"
            disabled={saving || !amount.trim()}
            onClick={() => void submit()}
          >
            {t("addSumSave")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
