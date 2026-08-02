"use client";

import { useLocale, useTranslations } from "next-intl";

import { PageBackButton } from "@/components/layout/page-back-button";
import { LocaleSelect } from "@/components/locale-select";
import { Link, usePathname, useRouter } from "@/i18n/navigation";

import { useEventContext } from "./event-context";

/** Event pages are reachable without an account, so they carry their own chrome. */
export function EventTopBar() {
  const tApp = useTranslations("app");
  const tSettings = useTranslations("settings");
  const { viewer } = useEventContext();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-2">
      {viewer.isAuthenticated ? (
        <PageBackButton fallbackHref="/events" className="mt-0" />
      ) : null}

      <Link
        href="/"
        className="flex min-w-0 items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground"
        >
          <span
            className="size-5 bg-current"
            style={{
              maskImage: "url(/logo.svg)",
              maskSize: "contain",
              maskRepeat: "no-repeat",
              maskPosition: "center",
              WebkitMaskImage: "url(/logo.svg)",
              WebkitMaskSize: "contain",
              WebkitMaskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
            }}
          />
        </span>
        <span className="truncate text-base font-semibold tracking-tight">
          {tApp("name")}
        </span>
      </Link>

      {viewer.isAuthenticated ? null : (
        <LocaleSelect
          value={locale}
          ariaLabel={tSettings("locale")}
          triggerClassName="ml-auto w-[9.5rem]"
          onValueChange={(next) => router.replace(pathname, { locale: next })}
        />
      )}
    </div>
  );
}
