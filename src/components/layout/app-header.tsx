"use client";

import {
  CalendarDays,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  Plane,
  Plus,
  Settings,
  Smartphone,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { ExchangeRatesDisplay } from "@/components/layout/exchange-rates-display";
import { PersonAvatar } from "@/components/person-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { EventPhaseBadge } from "@/features/events/event-timing-badge";
import { TravelPhaseBadge } from "@/features/travels/travel-phase-badge";
import { ConnectivityHeaderChip } from "@/features/offline/connectivity-chip";
import { useAppUser } from "@/hooks/use-app-user";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { eventAppPath } from "@/lib/event-routes";
import { cn } from "@/lib/utils";
import { useActiveTravelStore } from "@/stores/active-travel.store";
import { useUiStore } from "@/stores/ui.store";
import { useUpcomingEventStore } from "@/stores/upcoming-event.store";
import { AppTheme, TransactionFormMode } from "@/types/enums";

const PROFILE_ITEM_CLASS =
  "min-h-11 gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium [&_svg]:size-4";

/** Desktop top header (md+). Mobile uses MobileNavIsland. */
export function AppHeader() {
  const t = useTranslations("header");
  const tAuth = useTranslations("auth");
  const tNav = useTranslations("nav");
  const { theme, setTheme } = useTheme();
  const { user } = useAppUser();
  const openTransactionModal = useUiStore((state) => state.openTransactionModal);
  const activeTravel = useActiveTravelStore((state) => state.travel);
  const refreshActiveTravel = useActiveTravelStore((state) => state.refresh);
  const upcomingEvent = useUpcomingEventStore((state) => state.event);
  const refreshUpcomingEvent = useUpcomingEventStore((state) => state.refresh);
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    setThemeReady(true);
  }, []);

  useEffect(() => {
    void refreshActiveTravel();
  }, [refreshActiveTravel]);

  useEffect(() => {
    void refreshUpcomingEvent();
  }, [refreshUpcomingEvent]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await authClient.signOut();
      router.replace("/login");
    } finally {
      setLoggingOut(false);
    }
  }

  function cycleTheme() {
    if (theme === AppTheme.Light) {
      setTheme(AppTheme.Dark);
      return;
    }
    if (theme === AppTheme.Dark) {
      setTheme(AppTheme.System);
      return;
    }
    setTheme(AppTheme.Light);
  }

  const ThemeIcon = themeIconFor(theme);

  return (
    <header className="sticky top-0 z-30 flex h-14 min-w-0 items-center gap-1.5 border-b bg-background/90 py-0 pr-3 pl-2 backdrop-blur max-md:hidden md:gap-2 md:pr-4 md:pl-2">
      <SidebarTrigger className="shrink-0" />
      <Separator orientation="vertical" className="my-2.5" />
      <ExchangeRatesDisplay className="ml-1 hidden shrink-0 min-[1600px]:flex" />

      <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1 sm:gap-1.5 min-[1600px]:gap-2">
        <ConnectivityHeaderChip />
        {upcomingEvent ? (
          <Link
            href={eventAppPath(upcomingEvent.id)}
            className="mr-1 flex max-w-[14rem] items-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-2.5 py-1.5 text-xs"
            title={`${t("upcomingEvent")}: ${upcomingEvent.title}`}
          >
            <CalendarDays className="size-3.5 shrink-0 text-violet-600 dark:text-violet-300" />
            <span className="min-w-0 truncate font-medium">
              {upcomingEvent.title}
            </span>
            <EventPhaseBadge phase={upcomingEvent.phase} />
          </Link>
        ) : null}
        {activeTravel ? (
          <Link
            href={`/travels/${activeTravel.id}`}
            className="mr-1 flex max-w-[12rem] items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-xs"
            title={`${t("activeTravel")}: ${activeTravel.title}`}
          >
            <Plane className="size-3.5 shrink-0 text-sky-600" />
            <span className="min-w-0 truncate font-medium">
              {activeTravel.title}
            </span>
            <TravelPhaseBadge phase={activeTravel.phase} />
          </Link>
        ) : null}
        <div className="flex shrink-0 overflow-hidden rounded-xl border border-border/70">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 rounded-none border-0 px-2 text-xs min-[1600px]:px-3 min-[1600px]:text-sm"
            onClick={() => openTransactionModal(TransactionFormMode.Spending)}
          >
            <Plus data-icon="inline-start" className="size-4 shrink-0" />
            <span className="whitespace-nowrap min-[1600px]:hidden">
              {t("spending")}
            </span>
            <span className="hidden whitespace-nowrap min-[1600px]:inline">
              {t("addSpending")}
            </span>
          </Button>
          {activeTravel ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-none border-0 border-l border-border/70 bg-sky-500/15 px-2 text-sky-700 hover:bg-sky-500/25 dark:text-sky-200"
              aria-label={t("addTravelSpending")}
              onClick={() =>
                openTransactionModal(TransactionFormMode.Spending, {
                  travelId: activeTravel.id,
                })
              }
            >
              <Plane className="size-4" />
            </Button>
          ) : null}
        </div>
        <Button
          size="sm"
          className="h-8 shrink-0 gap-1 px-2 text-xs min-[1600px]:px-3 min-[1600px]:text-sm"
          onClick={() => openTransactionModal(TransactionFormMode.Earning)}
        >
          <Plus data-icon="inline-start" className="size-4 shrink-0" />
          <span className="whitespace-nowrap min-[1600px]:hidden">
            {t("earning")}
          </span>
          <span className="hidden whitespace-nowrap min-[1600px]:inline">
            {t("addEarning")}
          </span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={cycleTheme}
          aria-label={t("theme")}
        >
          {themeReady ? (
            <ThemeIcon />
          ) : (
            <Sun className="opacity-0" aria-hidden />
          )}
        </Button>

        <div className="hidden shrink-0 min-[1300px]:block">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0 rounded-full"
                />
              }
            >
              <PersonAvatar
                seed={user?.id ?? user?.username ?? "user"}
                name={user?.username ?? "?"}
                className="size-8"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="flex min-w-56 flex-col gap-1 rounded-xl p-1.5"
            >
              <DropdownMenuLabel className="px-3 py-1.5 text-xs">
                {user?.username ?? t("profile")}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuItem
                className={PROFILE_ITEM_CLASS}
                onClick={() => router.push("/devices")}
              >
                <Smartphone />
                {tNav("devices")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className={PROFILE_ITEM_CLASS}
                onClick={() => router.push("/settings")}
              >
                <Settings />
                {tNav("settings")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className={cn(PROFILE_ITEM_CLASS, "text-destructive")}
                onClick={() => void handleLogout()}
                disabled={loggingOut}
              >
                {loggingOut ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <LogOut />
                )}
                {tAuth("logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

function themeIconFor(theme: string | undefined) {
  if (theme === AppTheme.Dark) {
    return Moon;
  }
  if (theme === AppTheme.System) {
    return Monitor;
  }
  return Sun;
}
