"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DevicesSessionsList } from "@/features/devices/devices-sessions-list";
import {
  createLoginTransferRequest,
  getLoginTransferRequest,
  type LoginTransferDto,
} from "@/lib/api/login-transfer";
import { cn } from "@/lib/utils";

export function DevicesPage() {
  const t = useTranslations("devices");
  const locale = useLocale();
  const [transfer, setTransfer] = useState<LoginTransferDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const applyTransfer = useCallback((next: LoginTransferDto) => {
    setTransfer(next);
    setFailed(false);
    setSecondsLeft(
      Math.max(
        0,
        Math.ceil((new Date(next.expiresAt).getTime() - Date.now()) / 1000),
      ),
    );
  }, []);

  const loadTransfer = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const next = await getLoginTransferRequest(locale);
      applyTransfer(next);
    } catch (error) {
      setFailed(true);
      toast.error(
        error instanceof Error ? error.message : t("transferCreateFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [applyTransfer, locale, t]);

  const refreshTransfer = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const next = await createLoginTransferRequest(locale);
      applyTransfer(next);
    } catch (error) {
      setFailed(true);
      toast.error(
        error instanceof Error ? error.message : t("transferCreateFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [applyTransfer, locale, t]);

  useEffect(() => {
    void loadTransfer();
  }, [loadTransfer]);

  useEffect(() => {
    if (!transfer || failed || loading) {
      return;
    }

    const timer = window.setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((new Date(transfer.expiresAt).getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(remaining);
      if (remaining === 0) {
        window.clearInterval(timer);
        void refreshTransfer();
      }
    }, 250);

    return () => window.clearInterval(timer);
  }, [transfer, failed, loading, refreshTransfer]);

  const formattedCode = transfer
    ? `${transfer.code.slice(0, 3)} ${transfer.code.slice(3)}`
    : "";
  const countdownLabel = formatCountdown(secondsLeft);
  // Loading: skeleton QR/code/time. Errors: skeleton code/time, keep last QR.
  const showQrSkeleton = loading || !transfer;
  const showCodeSkeleton = loading || failed || !transfer;
  const showTimeSkeleton = loading || failed || !transfer;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-10 pb-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          {t("subtitle")}
        </p>
      </header>

      <section className="space-y-5 rounded-2xl border border-border/60 bg-card/40 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              {t("qrTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("qrHint")}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-12 shrink-0 rounded-xl sm:size-10"
            onClick={() => void refreshTransfer()}
            disabled={loading}
            aria-label={t("refreshCode")}
          >
            {loading ? (
              <Loader2 className="size-5 animate-spin sm:size-4" />
            ) : (
              <RefreshCw className="size-5 sm:size-4" />
            )}
          </Button>
        </div>

        <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="mx-auto rounded-2xl bg-white p-3">
            {showQrSkeleton || !transfer ? (
              <Skeleton className="size-44 rounded-xl" />
            ) : (
              <QRCodeSVG value={transfer.authUrl} size={176} level="M" />
            )}
          </div>

          <div className="space-y-4 text-center sm:text-left">
            <div>
              <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                {t("loginCode")}
              </p>
              {showCodeSkeleton ? (
                <Skeleton className="mx-auto mt-2 h-12 w-48 sm:mx-0" />
              ) : (
                <p className="mt-2 font-mono text-4xl font-semibold tracking-[0.2em] tabular-nums">
                  {formattedCode}
                </p>
              )}
            </div>
            {showTimeSkeleton ? (
              <Skeleton className="mx-auto h-5 w-36 sm:mx-0" />
            ) : (
              <p
                className={cn(
                  "text-sm tabular-nums",
                  secondsLeft <= 30
                    ? "text-amber-400"
                    : "text-muted-foreground",
                )}
              >
                {t("expiresIn", { time: countdownLabel })}
              </p>
            )}
          </div>
        </div>
      </section>

      <DevicesSessionsList />
    </div>
  );
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
