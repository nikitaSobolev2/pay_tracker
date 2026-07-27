"use client";

import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useState } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { buttonVariants } from "@/components/ui/button";
import { ApprovalPanel } from "@/features/auth/approval-panel";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export default function ApprovePage() {
  const t = useTranslations("qrApproval");
  const tApp = useTranslations("app");
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = typeof params.token === "string" ? params.token : "";
  const [resolved, setResolved] = useState(false);

  return (
    <AuthShell brand={tApp("name")} title={t("approveTitle")}>
      <div className="flex w-full flex-col gap-6">
        <ApprovalPanel
          token={token}
          onResolved={() => setResolved(true)}
          onClose={() => router.push("/")}
          closeLabel={t("backHome")}
        />
        {!resolved ? (
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "inline-flex h-11 w-full items-center justify-center rounded-xl",
            )}
          >
            {t("backHome")}
          </Link>
        ) : null}
      </div>
    </AuthShell>
  );
}
