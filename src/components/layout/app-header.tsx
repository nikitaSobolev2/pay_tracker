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
    <header className="sticky top-0 z-30 flex h-14 min-w-0 items-center gap-2 border-b bg-background/90 py-0 pr-3 pl-2 backdrop-blur max-md:hidden md:pr-4 md:pl-2">
      <SidebarTrigger className="shrink-0" />
      <Separator
        orientation="vertical"
        className="my-2.5"
      />
      <Button
        type="button"
        variant="outline"
        className="ml-1 h-8 w-full min-w-0 max-w-xs shrink justify-start gap-2 rounded-xl border-border/70 bg-card/40 px-3 text-muted-foreground sm:max-w-sm lg:max-w-md"
        onClick={onOpenSearch}
        aria-label={tSearch("shortcut")}
      >
        <Search className="size-4 shrink-0" />
        <span className="truncate text-sm">{tSearch("shortcut")}</span>
        <kbd className="pointer-events-none ml-auto inline shrink-0 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </Button>
      <ExchangeRatesDisplay className="ml-1 flex shrink-0 max-[1299px]:hidden" />

      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-8 shrink-0 gap-1 px-2.5 text-xs sm:px-3 sm:text-sm"
          onClick={() => openTransactionModal(TransactionFormMode.Spending)}
        >
          <Plus data-icon="inline-start" className="size-4 shrink-0" />
          <span className="whitespace-nowrap">{t("addSpending")}</span>
        </Button>
        <Button
          size="sm"
          className="h-8 shrink-0 gap-1 px-2.5 text-xs sm:px-3 sm:text-sm"
          onClick={() => openTransactionModal(TransactionFormMode.Earning)}
        >
          <Plus data-icon="inline-start" className="size-4 shrink-0" />
          <span className="whitespace-nowrap">{t("addEarning")}</span>
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

        <div className="shrink-0 max-[1299px]:hidden">
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
