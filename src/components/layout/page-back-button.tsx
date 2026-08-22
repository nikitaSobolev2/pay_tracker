"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type PageBackButtonProps = {
  /** Used when there is no in-app history to go back to. */
  readonly fallbackHref: string;
  readonly className?: string;
};

export function PageBackButton({
  fallbackHref,
  className,
}: PageBackButtonProps) {
  const t = useTranslations("common");
  const router = useRouter();

  function handleBack() {
    const hasSameOriginReferrer =
      typeof document !== "undefined" &&
      document.referrer.startsWith(window.location.origin);

    if (hasSameOriginReferrer) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={cn(
        "inline-flex h-auto min-h-11 w-11 shrink-0 self-stretch items-center justify-center rounded-xl p-0",
        className,
      )}
      onClick={handleBack}
      aria-label={t("back")}
    >
      <ArrowLeft className="size-5" />
    </Button>
  );
}

/** Back control + title content in one horizontal row. */
export function PageTitleWithBack({
  fallbackHref,
  children,
  className,
}: {
  readonly fallbackHref: string;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-stretch gap-1.5 sm:gap-2", className)}>
      <PageBackButton fallbackHref={fallbackHref} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
