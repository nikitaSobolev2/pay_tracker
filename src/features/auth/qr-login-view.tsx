"use client";

import { QRCodeSVG } from "qrcode.react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth/auth-shell";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApprovalWaiting } from "@/features/auth/approval-waiting";
import { Link } from "@/i18n/navigation";
import {
  createQrApproval,
  type QrApprovalRequestDto,
} from "@/lib/api/qr-approval";
import { cn } from "@/lib/utils";

/** Pull flow: unauthenticated device shows a QR and waits for phone approval. */
export function QrLoginView() {
  const t = useTranslations("auth");
  const tQr = useTranslations("qrApproval");
  const tApp = useTranslations("app");
  const locale = useLocale();
  const [request, setRequest] = useState<QrApprovalRequestDto | null>(null);
  const [loading, setLoading] = useState(true);
  const startedRef = useRef(false);

  const createRequest = useCallback(async () => {
    setLoading(true);
    try {
      setRequest(await createQrApproval(locale));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : tQr("createFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [locale, tQr]);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;
    void createRequest();
  }, [createRequest]);

  return (
    <AuthShell brand={tApp("name")} title={t("loginWithQr")}>
      <div className="flex w-full flex-col gap-6">
        <p className="text-center text-sm text-muted-foreground">
          {tQr("scanHint")}
        </p>

        <div className="mx-auto rounded-2xl bg-white p-3 shadow-sm">
          {loading || !request ? (
            <Skeleton className="size-44 rounded-xl" />
          ) : (
            <QRCodeSVG value={request.approvalUrl} size={176} level="M" />
          )}
        </div>

        {request ? (
          <ApprovalWaiting
            key={request.token}
            token={request.token}
            onRetry={() => void createRequest()}
          />
        ) : (
          <div className="flex justify-center py-2">
            <Skeleton className="h-5 w-48" />
          </div>
        )}

        <Link
          href="/login"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "inline-flex h-12 min-h-12 w-full items-center justify-center rounded-xl text-base font-medium sm:h-11 sm:min-h-11",
          )}
        >
          {t("backToLogin")}
        </Link>
      </div>
    </AuthShell>
  );
}
