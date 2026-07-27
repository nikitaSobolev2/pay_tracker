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
    <AuthShell brand={tApp("name")} title={t("qrLoginTitle")}>
      <div className="flex flex-col items-center gap-6 text-center">
        <p className="text-sm text-muted-foreground">{tQr("scanHint")}</p>

        <div className="rounded-2xl bg-white p-3">
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
        ) : null}

        <Link
          href="/login"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-12 w-full rounded-xl text-base",
          )}
        >
          {t("backToLogin")}
        </Link>
      </div>
    </AuthShell>
  );
}
