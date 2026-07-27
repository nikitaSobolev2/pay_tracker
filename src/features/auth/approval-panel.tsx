"use client";

import { Check, Loader2, ShieldQuestion, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useReadableDateTime } from "@/hooks/use-readable-date-time";
import {
  approveQrApproval,
  declineQrApproval,
  getQrApprovalInfo,
  type QrApprovalInfoDto,
} from "@/lib/api/qr-approval";
import { describeUserAgent } from "@/lib/user-agent";

type ApprovalOutcome = "approved" | "declined";

type ApprovalPanelProps = {
  /** Pull flow: token scanned/opened by the approver. */
  readonly token?: string;
  /** Push flow: row id surfaced in the owner's incoming list. */
  readonly approvalId?: string;
  readonly initialInfo?: QrApprovalInfoDto;
  readonly onResolved?: (outcome: ApprovalOutcome) => void;
};

/** Requester details + Approve/Decline, shared by scan modal, approve page, and incoming list. */
export function ApprovalPanel({
  token,
  approvalId,
  initialInfo,
  onResolved,
}: ApprovalPanelProps) {
  const t = useTranslations("qrApproval");
  const tDevice = useTranslations("devices");
  const formatDateTime = useReadableDateTime();
  const [info, setInfo] = useState<QrApprovalInfoDto | null>(
    initialInfo ?? null,
  );
  const [loading, setLoading] = useState(!initialInfo);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<ApprovalOutcome | null>(null);
  const [outcome, setOutcome] = useState<ApprovalOutcome | null>(null);

  useEffect(() => {
    if (initialInfo || !token) {
      return;
    }
    let active = true;
    async function load() {
      try {
        const next = await getQrApprovalInfo(token!);
        if (active) {
          setInfo(next);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error ? loadError.message : t("invalid"),
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [token, initialInfo, t]);

  async function resolve(kind: ApprovalOutcome) {
    const ref = token ? { token } : { id: approvalId };
    setBusy(kind);
    try {
      if (kind === "approved") {
        await approveQrApproval(ref);
      } else {
        await declineQrApproval(ref);
      }
      setOutcome(kind);
      onResolved?.(kind);
    } catch (actionError) {
      toast.error(
        actionError instanceof Error ? actionError.message : t("actionFailed"),
      );
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <Skeleton className="h-40 w-full rounded-2xl" />;
  }

  if (error) {
    return <ResultMessage tone="error" title={error} />;
  }

  const displayState = outcome ?? info?.status ?? "expired";

  if (displayState === "approved" || displayState === "consumed") {
    return (
      <ResultMessage
        tone="success"
        title={t("approvedTitle")}
        hint={t("approvedHint")}
      />
    );
  }
  if (displayState === "declined") {
    return (
      <ResultMessage
        tone="error"
        title={t("declinedTitle")}
        hint={t("declinedHint")}
      />
    );
  }
  if (displayState === "expired" || !info) {
    return <ResultMessage tone="error" title={t("expired")} />;
  }

  const deviceLabel = describeUserAgent(info.requesterUserAgent, {
    unknownDevice: tDevice("unknownDevice"),
    unknownBrowser: tDevice("unknownBrowser"),
    unknownOs: tDevice("unknownOs"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card/40 p-4">
        <ShieldQuestion className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 space-y-3">
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="text-muted-foreground">{t("requestedBy")}</dt>
              <dd className="font-medium">{deviceLabel}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{tDevice("ipAddress")}</dt>
              <dd className="font-medium tabular-nums">
                {info.requesterIp || tDevice("unknownIp")}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("requestedAt")}</dt>
              <dd className="font-medium">
                {formatDateTime(new Date(info.createdAt))}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          className="h-12 w-full gap-2 rounded-xl text-base sm:h-11"
          disabled={busy !== null}
          onClick={() => void resolve("approved")}
        >
          {busy === "approved" ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Check data-icon="inline-start" />
          )}
          {t("approve")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full gap-2 rounded-xl text-base sm:h-11"
          disabled={busy !== null}
          onClick={() => void resolve("declined")}
        >
          {busy === "declined" ? (
            <Loader2 className="animate-spin" />
          ) : (
            <X data-icon="inline-start" />
          )}
          {t("decline")}
        </Button>
      </div>
    </div>
  );
}

function ResultMessage({
  tone,
  title,
  hint,
}: {
  readonly tone: "success" | "error";
  readonly title: string;
  readonly hint?: string;
}) {
  const Icon = tone === "success" ? Check : X;
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-card/40 px-4 py-8 text-center">
      <div
        className={
          tone === "success"
            ? "flex size-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400"
            : "flex size-12 items-center justify-center rounded-full bg-destructive/15 text-destructive"
        }
      >
        <Icon className="size-6" />
      </div>
      <p className="text-base font-semibold tracking-tight">{title}</p>
      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
