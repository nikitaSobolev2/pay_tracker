"use client";

import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth/auth-shell";
import { buttonVariants } from "@/components/ui/button";
import { ApprovalWaiting } from "@/features/auth/approval-waiting";
import { Link } from "@/i18n/navigation";
import { redeemLoginTransferRequest } from "@/lib/api/login-transfer";
import { cn } from "@/lib/utils";

export default function QrLoginPage() {
  const t = useTranslations("auth");
  const tApp = useTranslations("app");
  const locale = useLocale();
  const params = useParams<{ token: string }>();
  const token = typeof params.token === "string" ? params.token : "";
  const [approvalToken, setApprovalToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!token || startedRef.current) {
      return;
    }
    startedRef.current = true;

    async function claim() {
      setLoading(true);
      setError(null);
      try {
        const redeemed = await redeemLoginTransferRequest({ token, locale });
        setApprovalToken(redeemed.token);
      } catch (redeemError) {
        const message =
          redeemError instanceof Error
            ? redeemError.message
            : t("loginCodeInvalid");
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    }

    void claim();
  }, [token, locale, t]);

  return (
    <AuthShell brand={tApp("name")} title={t("qrLoginTitle")}>
      <div className="flex flex-col items-center gap-6 text-center">
        {loading ? (
          <>
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("qrLoginPending")}</p>
          </>
        ) : approvalToken ? (
          <ApprovalWaiting token={approvalToken} />
        ) : (
          <>
            <p className="text-sm text-destructive">
              {error ?? t("loginCodeInvalid")}
            </p>
            <div className="flex w-full flex-col gap-3">
              <Link
                href="/login/code"
                className={cn(
                  buttonVariants({ variant: "default" }),
                  "h-12 w-full rounded-xl text-base",
                )}
              >
                {t("loginWithCode")}
              </Link>
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
          </>
        )}
      </div>
    </AuthShell>
  );
}
