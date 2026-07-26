"use client";

import {
  Loader2,
  LogOut,
  Monitor,
  Moon,
  Plus,
  Search,
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
import { useAppUser } from "@/hooks/use-app-user";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui.store";
import { AppTheme, TransactionFormMode } from "@/types/enums";

const PROFILE_ITEM_CLASS =
  "min-h-11 gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium [&_svg]:size-4";

type AppHeaderProps = {
  readonly onOpenSearch: () => void;
};

/** Desktop top header (md+). Mobile uses MobileNavIsland. */
export function AppHeader({ onOpenSearch }: AppHeaderProps) {
  const t = useTranslations("header");
  const tSearch = useTranslations("search");
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
    <header className="sticky top-0 z-30 hidden h-14 min-w-0 items-center gap-2 overflow-x-clip border-b bg-background/90 px-3 backdrop-blur md:flex md:px-4">
      <SidebarTrigger className="shrink-0" />
      <Separator
        orientation="vertical"
        className="mr-1 hidden h-auto self-stretch md:block"
      />
      <Button
        type="button"
        variant="outline"
        className="ml-1 h-8 w-full max-w-[12.5rem] justify-start gap-2 rounded-xl border-border/70 bg-card/40 px-3 text-muted-foreground sm:max-w-[14rem]"
        onClick={onOpenSearch}
        aria-label={tSearch("shortcut")}
      >
        <Search className="size-4 shrink-0" />
        <span className="truncate text-sm">{tSearch("shortcut")}</span>
        <kbd className="pointer-events-none ml-auto hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground xl:inline">
          ⌘K
        </kbd>
      </Button>
      <ExchangeRatesDisplay className="ml-1 hidden min-w-0 shrink xl:flex" />

      <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-8 min-w-0 shrink gap-1 px-2.5 text-xs xl:px-3 xl:text-sm"
          onClick={() => openTransactionModal(TransactionFormMode.Spending)}
        >
          <Plus data-icon="inline-start" className="size-4 shrink-0" />
          <span className="truncate xl:hidden">{t("spending")}</span>
          <span className="hidden truncate xl:inline">{t("addSpending")}</span>
        </Button>
        <Button
          size="sm"
          className="h-8 min-w-0 shrink gap-1 px-2.5 text-xs xl:px-3 xl:text-sm"
          onClick={() => openTransactionModal(TransactionFormMode.Earning)}
        >
          <Plus data-icon="inline-start" className="size-4 shrink-0" />
          <span className="truncate xl:hidden">{t("earning")}</span>
          <span className="hidden truncate xl:inline">{t("addEarning")}</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="hidden shrink-0 lg:inline-flex"
          onClick={cycleTheme}
          aria-label={t("theme")}
        >
          {themeReady ? (
            <ThemeIcon />
          ) : (
            <Sun className="opacity-0" aria-hidden />
          )}
        </Button>

        <div className="hidden shrink-0 lg:block">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 rounded-full"
                />
              }
            >
              <Avatar className="size-8">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
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
