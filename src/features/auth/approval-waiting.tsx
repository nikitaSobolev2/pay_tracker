"use client";

import { Check, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import {
  getQrApprovalStatus,
  redeemQrApproval,
} from "@/lib/api/qr-approval";
import type { QrApprovalStatus } from "@/lib/qr-approval";

const POLL_INTERVAL_MS = 2000;

type WaitingState =
  | "waiting"
  | "redeeming"
  | "declined"
  | "expired"
  | "error";

type ApprovalWaitingProps = {
  readonly token: string;
  /** Shown when the request can be re-created (pull flow). */
  readonly onRetry?: () => void;
};

/**
 * Polls an approval token and, once approved, exchanges it for a session and
 * redirects home. Shared by the pull-flow QR view and the code/old-QR pages.
 */
export function ApprovalWaiting({ token, onRetry }: ApprovalWaitingProps) {
  const t = useTranslations("qrApproval");
  const router = useRouter();
  const [state, setState] = useState<WaitingState>("waiting");
  const redeemingRef = useRef(false);

  useEffect(() => {
    redeemingRef.current = false;
    let active = true;

    async function redeem() {
      redeemingRef.current = true;
      setState("redeeming");
      try {
        await redeemQrApproval(token);
        router.replace("/");
      } catch {
        if (active) {
          setState("error");
        }
      }
    }

    async function poll() {
      if (!active || redeemingRef.current) {
        return;
      }
      try {
        const status = await getQrApprovalStatus(token);
        if (!active) {
          return;
        }
        applyStatus(status);
      } catch {
        if (active) {
          setState("error");
        }
      }
    }

    function applyStatus(status: QrApprovalStatus) {
      if (status === "approved") {
        void redeem();
        return;
      }
      if (status === "declined") {
        setState("declined");
        return;
      }
      if (status === "expired" || status === "consumed") {
        setState("expired");
        return;
      }
    }

    const timer = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    void poll();

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [token, router]);

  if (state === "waiting" || state === "redeeming") {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 className="size-7 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {state === "redeeming" ? t("signingIn") : t("waitingApproval")}
        </p>
      </div>
    );
  }

  const isDeclined = state === "declined";
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
        <X className="size-6" />
      </div>
      <p className="text-base font-semibold tracking-tight">
        {isDeclined ? t("declinedTitle") : t("expired")}
      </p>
      <p className="text-sm text-muted-foreground">
        {isDeclined ? t("declinedRequesterHint") : t("expiredHint")}
      </p>
      {onRetry ? (
        <Button
          type="button"
          className="h-11 w-full gap-2 rounded-xl"
          onClick={onRetry}
        >
          <Check data-icon="inline-start" />
          {t("tryAgain")}
        </Button>
      ) : null}
    </div>
  );
}
