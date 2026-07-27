"use client";

import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { ApprovalWaiting } from "@/features/auth/approval-waiting";
import { Link } from "@/i18n/navigation";
import { redeemLoginTransferRequest } from "@/lib/api/login-transfer";
import { LOGIN_TRANSFER_CODE_LENGTH } from "@/lib/login-transfer";

export default function LoginByCodePage() {
  const t = useTranslations("auth");
  const tApp = useTranslations("app");
  const locale = useLocale();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [approvalToken, setApprovalToken] = useState<string | null>(null);
  const submittedCodeRef = useRef<string | null>(null);

  const submitCode = useCallback(
    async (nextCode: string) => {
      setLoading(true);
      try {
        const { token } = await redeemLoginTransferRequest({
          code: nextCode,
          locale,
        });
        setApprovalToken(token);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("loginCodeInvalid"),
        );
        submittedCodeRef.current = null;
        setCode("");
      } finally {
        setLoading(false);
      }
    },
    [locale, t],
  );

  useEffect(() => {
    if (code.length !== LOGIN_TRANSFER_CODE_LENGTH) {
      return;
    }
    if (loading || submittedCodeRef.current === code) {
      return;
    }
    submittedCodeRef.current = code;
    void submitCode(code);
  }, [code, loading, submitCode]);

  if (approvalToken) {
    return (
      <AuthShell brand={tApp("name")} title={t("qrLoginTitle")}>
        <ApprovalWaiting token={approvalToken} />
      </AuthShell>
    );
  }

  return (
    <AuthShell brand={tApp("name")} title={t("loginCodeTitle")}>
      <div className="flex flex-col gap-8">
        <p className="text-sm text-muted-foreground">{t("loginCodeHint")}</p>
        <div className="flex justify-center">
          <InputOTP
            maxLength={LOGIN_TRANSFER_CODE_LENGTH}
            value={code}
            onChange={(value) => setCode(value.replace(/\D/g, ""))}
            disabled={loading}
            inputMode="numeric"
            autoFocus
          >
            <InputOTPGroup className="gap-2">
              {Array.from({ length: LOGIN_TRANSFER_CODE_LENGTH }, (_, index) => (
                <InputOTPSlot
                  key={`otp-${index}`}
                  index={index}
                  className="h-12 w-11 rounded-xl border text-lg"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
        <div className="flex flex-col gap-4">
          <Button
            type="button"
            disabled={loading || code.length !== LOGIN_TRANSFER_CODE_LENGTH}
            className="h-12 min-h-12 w-full rounded-xl text-base font-medium sm:h-11 sm:min-h-11"
            onClick={() => void submitCode(code)}
          >
            {loading ? <Loader2 className="animate-spin" /> : null}
            {t("loginWithCode")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link
              href="/login"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {t("backToLogin")}
            </Link>
          </p>
        </div>
      </div>
    </AuthShell>
  );
}
