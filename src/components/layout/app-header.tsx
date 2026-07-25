"use client";

import {
  Loader2,
  LogOut,
  Monitor,
  Moon,
  Plus,
  Settings,
  Smartphone,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { ExchangeRatesDisplay } from "@/components/layout/exchange-rates-display";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { SearchSpotlight } from "@/features/search/search-spotlight";
import { useAppUser } from "@/hooks/use-app-user";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui.store";
import { AppTheme, TransactionFormMode } from "@/types/enums";

const PROFILE_ITEM_CLASS =
  "min-h-14 gap-3 rounded-xl px-3.5 py-3.5 text-base font-medium md:min-h-11 md:gap-2.5 md:rounded-lg md:px-3 md:py-2.5 md:text-sm [&_svg]:size-5 md:[&_svg]:size-4";

export function AppHeader() {
  const t = useTranslations("header");
  const tAuth = useTranslations("auth");
  const tNav = useTranslations("nav");
  const { theme, setTheme } = useTheme();
  const { user } = useAppUser();
  const openTransactionModal = useUiStore((state) => state.openTransactionModal);
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    setThemeReady(true);
  }, []);

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

  const initials = (user?.username ?? "?").slice(0, 2).toUpperCase();
  const ThemeIcon = themeIconFor(theme);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur md:px-4">
      <SidebarTrigger />
      <Separator
        orientation="vertical"
        className="mr-1 hidden h-auto self-stretch sm:block"
      />
      <SearchSpotlight className="ml-1 shrink-0" />
      <ExchangeRatesDisplay className="ml-1 hidden md:flex" />

      <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-9 shrink gap-1 px-2.5 text-xs sm:h-8 sm:px-3 sm:text-sm"
          onClick={() => openTransactionModal(TransactionFormMode.Spending)}
        >
          <Plus data-icon="inline-start" className="size-3.5 sm:size-4" />
          <span>{t("addSpending")}</span>
        </Button>
        <Button
          size="sm"
          className="h-9 shrink gap-1 px-2.5 text-xs sm:h-8 sm:px-3 sm:text-sm"
          onClick={() => openTransactionModal(TransactionFormMode.Earning)}
        >
          <Plus data-icon="inline-start" className="size-3.5 sm:size-4" />
          <span>{t("addEarning")}</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="hidden md:inline-flex"
          onClick={cycleTheme}
          aria-label={t("theme")}
        >
          {themeReady ? (
            <ThemeIcon />
          ) : (
            <Sun className="opacity-0" aria-hidden />
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-11 rounded-full md:size-9"
              />
            }
          >
            <Avatar className="size-9 md:size-8">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="flex min-w-64 flex-col gap-1 rounded-2xl p-2 md:min-w-56 md:rounded-xl md:p-1.5"
          >
            <DropdownMenuLabel className="px-3.5 py-2.5 text-sm md:px-3 md:py-1.5 md:text-xs">
              {user?.username ?? t("profile")}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="my-1.5 md:my-1" />
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
