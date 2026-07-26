"use client";

import {
  HandCoins,
  Home,
  List,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Share2,
  Smartphone,
  Sun,
  Tags,
  Users,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { ExchangeRatesDisplay } from "@/components/layout/exchange-rates-display";
import { Button } from "@/components/ui/button";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { AppTheme } from "@/types/enums";

const NAV_ITEMS = [
  { href: "/", key: "home", icon: Home },
  { href: "/transactions", key: "transactions", icon: List },
  { href: "/debts", key: "debts", icon: HandCoins },
  { href: "/shared-charts", key: "sharedCharts", icon: Share2 },
  { href: "/categories", key: "categories", icon: Tags },
  { href: "/counterparties", key: "counterparties", icon: Users },
] as const;

const SETTINGS_ITEM = {
  href: "/settings",
  key: "settings",
  icon: Settings,
} as const;

const MOBILE_ACCOUNT_ITEMS = [
  { href: "/devices", key: "devices", icon: Smartphone },
  SETTINGS_ITEM,
] as const;

function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  if (href === "/transactions") {
    return (
      pathname === "/transactions" ||
      pathname.startsWith("/transactions/") ||
      pathname === "/spendings" ||
      pathname.startsWith("/spendings/") ||
      pathname === "/earnings" ||
      pathname.startsWith("/earnings/")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar() {
  const t = useTranslations("nav");
  const tApp = useTranslations("app");
  const tAuth = useTranslations("auth");
  const tCommon = useTranslations("common");
  const tHeader = useTranslations("header");
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { isMobile, setOpenMobile } = useSidebar();
  const [loggingOut, setLoggingOut] = useState(false);
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    setThemeReady(true);
  }, []);

  function handleNavigate() {
    if (isMobile) {
      setOpenMobile(false);
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

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await authClient.signOut();
      setOpenMobile(false);
      router.replace("/login");
    } finally {
      setLoggingOut(false);
    }
  }

  const ThemeIcon = themeIconFor(theme);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex shrink-0 flex-row items-center gap-2 p-3 group-data-[collapsible=icon]:p-2">
        <Link
          href="/"
          onClick={handleNavigate}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:self-center"
        >
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground"
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
          <span className="truncate text-lg font-semibold tracking-tight md:text-base group-data-[collapsible=icon]:sr-only">
            {tApp("name")}
          </span>
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0 rounded-xl md:hidden [&_svg]:size-5!"
          onClick={() => setOpenMobile(false)}
          aria-label={tCommon("close")}
        >
          <X />
        </Button>
      </SidebarHeader>
      <SidebarContent className="flex-1">
        <SidebarGroup className="mt-auto px-2 py-1 md:mt-0">
          <SidebarGroupContent className="text-base">
            <SidebarMenu className="gap-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={
                        <Link href={item.href} onClick={handleNavigate} />
                      }
                      isActive={isNavItemActive(pathname, item.href)}
                      tooltip={t(item.key)}
                      size="lg"
                      className="h-12 gap-3 rounded-xl px-3.5 text-base font-medium md:h-12 md:text-base [&_svg]:size-5 group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:rounded-xl"
                    >
                      <Icon />
                      <span>{t(item.key)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-2 border-t border-sidebar-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
        <ExchangeRatesDisplay className="flex w-full justify-center" />
        <SidebarMenu className="gap-1">
          {MOBILE_ACCOUNT_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <SidebarMenuItem key={`account-${item.href}`}>
                <SidebarMenuButton
                  render={<Link href={item.href} onClick={handleNavigate} />}
                  isActive={isNavItemActive(pathname, item.href)}
                  size="lg"
                  className="h-11 gap-3 rounded-xl px-3 text-base font-medium [&_svg]:size-5"
                >
                  <Icon />
                  <span>{t(item.key)}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
          <SidebarMenuItem>
            <div className="flex w-full items-center gap-2 px-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 shrink-0 rounded-xl [&_svg]:size-5!"
                onClick={cycleTheme}
                aria-label={tHeader("theme")}
              >
                {themeReady ? (
                  <ThemeIcon />
                ) : (
                  <Sun className="opacity-0" aria-hidden />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={loggingOut}
                onClick={() => void handleLogout()}
                aria-label={tAuth("logout")}
                className="size-11 shrink-0 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive [&_svg]:size-5!"
              >
                {loggingOut ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <LogOut />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-auto size-11 shrink-0 rounded-xl [&_svg]:size-5!"
                onClick={() => setOpenMobile(false)}
                aria-label={tCommon("close")}
              >
                <X />
              </Button>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
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
