"use client";

import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { buttonVariants } from "@/components/ui/button";
import { ApprovalPanel } from "@/features/auth/approval-panel";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export default function ApprovePage() {
  const t = useTranslations("qrApproval");
  const tApp = useTranslations("app");
  const params = useParams<{ token: string }>();
  const token = typeof params.token === "string" ? params.token : "";

  return (
    <AuthShell brand={tApp("name")} title={t("approveTitle")}>
      <div className="flex flex-col gap-6">
        <ApprovalPanel token={token} />
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "h-11 w-full rounded-xl",
          )}
        >
          {t("backHome")}
        </Link>
      </div>
    </AuthShell>
  );
}
