"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth/auth-shell";
import { buttonVariants } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { redeemLoginTransferRequest } from "@/lib/api/login-transfer";
import { cn } from "@/lib/utils";

export default function QrLoginPage() {
  const t = useTranslations("auth");
  const tApp = useTranslations("app");
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = typeof params.token === "string" ? params.token : "";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!token || startedRef.current) {
      return;
    }
    startedRef.current = true;

    async function redeem() {
      setLoading(true);
      setError(null);
      try {
        await redeemLoginTransferRequest({ token });
        router.replace("/");
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

    void redeem();
  }, [token, router, t]);

  return (
    <AuthShell brand={tApp("name")} title={t("qrLoginTitle")}>
      <div className="flex flex-col items-center gap-6 text-center">
        {loading ? (
          <>
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("qrLoginPending")}</p>
          </>
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
