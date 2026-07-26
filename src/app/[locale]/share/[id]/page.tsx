"use client";

import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { LocaleSelect } from "@/components/locale-select";
import {
  SharedChartType,
  type SharedChartPayload,
} from "@/features/share/shared-chart-payload";
import { SharedChartView } from "@/features/share/shared-chart-view";
import { usePathname, useRouter } from "@/i18n/navigation";
import { fetchPublicShare } from "@/lib/api/shares";
import { cn } from "@/lib/utils";
import type { PublicSharedChartDto } from "@/server/services/shared-chart-service";

export default function PublicSharedChartPage() {
  const t = useTranslations("share");
  const tApp = useTranslations("app");
  const tSettings = useTranslations("settings");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ id: string }>();
  const shareId = params.id;
  const [share, setShare] = useState<PublicSharedChartDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPublicShare(shareId)
      .then((result) => {
        if (!cancelled) {
          setShare(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(t("unavailable"));
          setShare(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [shareId, t]);

  return (
    <div className="relative flex min-h-svh flex-col bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.35_0.04_250_/_0.35),transparent_55%)]" />
      <header className="relative z-10 flex flex-col items-center gap-3 px-4 py-6 md:px-8">
        <p className="text-center text-2xl font-semibold tracking-tight md:text-3xl">
          {tApp("name")}
        </p>
        <LocaleSelect
          value={locale}
          ariaLabel={tSettings("locale")}
          triggerClassName="w-[9.5rem]"
          onValueChange={(next) => {
            router.replace(pathname, { locale: next });
          }}
        />
      </header>
      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-6 px-4 pb-12 md:px-8">
        {loading ? (
          <p className="text-muted-foreground">{t("loading")}</p>
        ) : error || !share ? (
          <div className="rounded-2xl border border-border/60 bg-card/80 px-8 py-10 text-center">
            <p className="text-lg font-medium">{error ?? t("unavailable")}</p>
          </div>
        ) : (
          <>
            {share.title ? (
              <h1 className="max-w-2xl text-center text-xl font-semibold tracking-tight md:text-2xl">
                {share.title}
              </h1>
            ) : null}
            <div
              className={cn(
                "mx-auto w-full",
                sharedChartWidthClass(share.payload),
              )}
            >
              <SharedChartView payload={share.payload} shareId={share.id} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function sharedChartWidthClass(payload: SharedChartPayload): string {
  switch (payload.type) {
    case SharedChartType.MoneyValue:
    case SharedChartType.VsPrevious:
      return "max-w-md";
    case SharedChartType.IncomeVsSpendings:
    case SharedChartType.PeriodTotals:
    case SharedChartType.CurrencyBreakdown:
      return "max-w-lg";
    case SharedChartType.DebtSummary:
      return "max-w-3xl";
    default:
      return "max-w-5xl";
  }
}
