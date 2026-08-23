"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type TransitionEvent,
} from "react";
import {
  ArrowLeft,
  FileText,
  Menu,
  MessageSquare,
  Plane,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransactionTypeSwitcher } from "@/features/transactions/transaction-type-switcher";
import { cn } from "@/lib/utils";
import { useActiveTravelStore } from "@/stores/active-travel.store";
import {
  useMobilePageChromeStore,
  type MobilePageChrome,
  type MobilePageChromeAction,
} from "@/stores/mobile-page-chrome.store";
import { useUiStore } from "@/stores/ui.store";
import { TransactionFormMode } from "@/types/enums";

type MobileNavIslandProps = {
  readonly onOpenSearch: () => void;
};

/** Square icon slot shared by chrome action + search/menu for column alignment. */
const ICON_SLOT_CLASS = "flex size-12 shrink-0 items-center justify-center";

const ICON_BUTTON_CLASS = cn(
  "size-12 shrink-0 rounded-full p-0 text-foreground",
  "hover:bg-foreground/10 active:bg-foreground/15",
);

/** Floating liquid-glass action island for mobile (&lt; md). */
export function MobileNavIsland({ onOpenSearch }: MobileNavIslandProps) {
  const t = useTranslations("header");
  const tCommon = useTranslations("common");
  const { toggleSidebar } = useSidebar();
  const openTransactionModal = useUiStore((state) => state.openTransactionModal);
  const activeTravel = useActiveTravelStore((state) => state.travel);
  const refreshActiveTravel = useActiveTravelStore((state) => state.refresh);
  const chrome = useMobilePageChromeStore((state) => state.chrome);
  const { renderedChrome, chromeOpen, onChromeTransitionEnd } =
    useAnimatedPageChrome(chrome);
  const showChromeSlot = renderedChrome != null;

  useEffect(() => {
    void refreshActiveTravel();
  }, [refreshActiveTravel]);

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-40 flex justify-center px-3 md:hidden",
        "bottom-[max(0.75rem,env(safe-area-inset-bottom))]",
      )}
    >
      <div
        className={cn(
          "pointer-events-auto grid w-full max-w-md grid-cols-1 gap-1 p-1.5",
          "border border-white/15 bg-background/60 shadow-[0_8px_32px_oklch(0_0_0/0.28)]",
          "backdrop-blur-2xl backdrop-saturate-150",
          "supports-backdrop-filter:bg-background/45",
          "transition-[border-radius] duration-300 ease-out",
          showChromeSlot ? "rounded-[1.75rem]" : "rounded-full",
        )}
      >
        {showChromeSlot ? (
          <div
            className={cn(
              "grid min-h-0 transition-[grid-template-rows,opacity] duration-300 ease-out",
              chromeOpen
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0",
            )}
            onTransitionEnd={onChromeTransitionEnd}
          >
            <div className="min-h-0 overflow-hidden">
              {renderedChrome ? (
                <PageChromeRow chrome={renderedChrome} />
              ) : null}
            </div>
          </div>
        ) : null}

        <nav
          className={
            activeTravel
              ? "grid h-12 grid-cols-[3rem_minmax(0,1fr)_3rem_minmax(0,1fr)_3rem] items-center gap-1"
              : "grid h-12 grid-cols-[3rem_minmax(0,1fr)_minmax(0,1fr)_3rem] items-center gap-1"
          }
        >
          <IslandIconButton
            ariaLabel={tCommon("search")}
            onClick={onOpenSearch}
          >
            <Search className="size-5" />
          </IslandIconButton>
          <IslandLabelButton
            ariaLabel={t("spending")}
            label={activeTravel ? "" : t("spending")}
            onClick={() => openTransactionModal(TransactionFormMode.Spending)}
          >
            <Plus className="size-4 text-rose-400" />
          </IslandLabelButton>
          {activeTravel ? (
            <IslandIconButton
              ariaLabel={t("addTravelSpending")}
              onClick={() =>
                openTransactionModal(TransactionFormMode.Spending, {
                  travelId: activeTravel.id,
                })
              }
            >
              <Plane className="size-5 text-sky-500" />
            </IslandIconButton>
          ) : null}
          <IslandLabelButton
            ariaLabel={t("earning")}
            label={activeTravel ? "" : t("earning")}
            onClick={() => openTransactionModal(TransactionFormMode.Earning)}
          >
            <Plus className="size-4 text-emerald-400" />
          </IslandLabelButton>
          <IslandIconButton ariaLabel={t("menu")} onClick={toggleSidebar}>
            <Menu className="size-5" />
          </IslandIconButton>
        </nav>
      </div>
    </div>
  );
}

function useAnimatedPageChrome(chrome: MobilePageChrome | null) {
  const setChromeExpanded = useMobilePageChromeStore(
    (state) => state.setChromeExpanded,
  );
  const [renderedChrome, setRenderedChrome] = useState<MobilePageChrome | null>(
    null,
  );
  const [chromeOpen, setChromeOpen] = useState(false);
  const chromeOpenRef = useRef(false);
  chromeOpenRef.current = chromeOpen;

  useEffect(() => {
    if (chrome) {
      setRenderedChrome(chrome);
      setChromeExpanded(true);
      const frame = requestAnimationFrame(() => setChromeOpen(true));
      return () => cancelAnimationFrame(frame);
    }

    // Already closed — clear immediately (no nested setState in updater).
    if (!chromeOpenRef.current) {
      setRenderedChrome(null);
      setChromeExpanded(false);
      return;
    }

    setChromeOpen(false);
  }, [chrome, setChromeExpanded]);

  function onChromeTransitionEnd(event: TransitionEvent<HTMLDivElement>) {
    if (event.propertyName !== "grid-template-rows") return;
    if (!chrome) {
      setRenderedChrome(null);
      setChromeExpanded(false);
    }
  }

  return { renderedChrome, chromeOpen, onChromeTransitionEnd };
}

function PageChromeRow({ chrome }: { readonly chrome: MobilePageChrome }) {
  const hasBack = chrome.backAction != null;
  const hasAction = chrome.action != null;
  const hasFilter =
    chrome.typeFilter != null || chrome.segmentFilter != null;

  // Events / travels / categories / debts: only a CTA → full-width labeled button.
  if (
    (chrome.action?.kind === "add" || chrome.action?.kind === "report") &&
    !hasBack &&
    !hasFilter
  ) {
    return (
      <Button
        type="button"
        variant="ghost"
        className="h-12 w-full gap-1.5 rounded-full px-3 text-foreground hover:bg-foreground/10 active:bg-foreground/15"
        onClick={chrome.action.onClick}
        aria-label={chrome.action.label}
      >
        {chrome.action.kind === "report" ? (
          <FileText className="size-4 shrink-0" />
        ) : (
          <Plus className="size-4 shrink-0" />
        )}
        <span className="truncate text-sm font-medium">
          {chrome.action.label}
        </span>
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "grid h-12 gap-1",
        hasBack && hasAction
          ? "grid-cols-[minmax(0,1fr)_3rem_3rem]"
          : hasBack || hasAction
            ? "grid-cols-[minmax(0,1fr)_3rem]"
            : "grid-cols-1",
      )}
    >
      <div className="flex h-12 min-w-0 items-center">
        <PageChromeFilter chrome={chrome} />
      </div>
      {chrome.backAction ? (
        <div className={ICON_SLOT_CLASS}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={ICON_BUTTON_CLASS}
            onClick={chrome.backAction.onClick}
            aria-label={chrome.backAction.label}
          >
            <ArrowLeft className="size-5" />
          </Button>
        </div>
      ) : null}
      {chrome.action ? (
        <div className={ICON_SLOT_CLASS}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(ICON_BUTTON_CLASS, "relative")}
            onClick={chrome.action.onClick}
            aria-label={chrome.action.label}
          >
            <PageChromeActionIcon action={chrome.action} />
            {chrome.action.kind === "filters" && chrome.action.active ? (
              <span
                aria-hidden
                className="absolute top-2.5 right-2.5 size-2 rounded-full bg-foreground"
              />
            ) : null}
            {chrome.action.kind === "chat" && chrome.action.unreadCount > 0 ? (
              <span
                className={cn(
                  "absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1",
                  "bg-primary text-[10px] font-semibold leading-none text-primary-foreground",
                )}
              >
                {chrome.action.unreadCount > 9
                  ? "9+"
                  : chrome.action.unreadCount}
              </span>
            ) : null}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function PageChromeFilter({ chrome }: { readonly chrome: MobilePageChrome }) {
  if (chrome.typeFilter) {
    return (
      <TransactionTypeSwitcher
        compact
        className="h-12 w-full min-w-0 justify-center gap-0"
        value={chrome.typeFilter.value}
        onChange={chrome.typeFilter.onChange}
      />
    );
  }
  if (chrome.segmentFilter) {
    return <SegmentFilterSwitcher filter={chrome.segmentFilter} />;
  }
  return null;
}

function SegmentFilterSwitcher({
  filter,
}: {
  readonly filter: NonNullable<MobilePageChrome["segmentFilter"]>;
}) {
  const optionValues = new Set(filter.options.map((option) => option.value));

  return (
    <Tabs
      className="h-12 w-full min-w-0 justify-center gap-0"
      value={filter.value}
      onValueChange={(next) => {
        if (optionValues.has(next)) {
          filter.onChange(next);
        }
      }}
    >
      <TabsList className="h-12 w-full rounded-full p-1">
        {filter.options.map((option) => (
          <TabsTrigger
            key={option.value}
            value={option.value}
            className="rounded-full px-1.5 text-xs sm:px-2 sm:text-sm"
          >
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

function PageChromeActionIcon({
  action,
}: {
  readonly action: MobilePageChromeAction;
}) {
  if (action.kind === "filters") {
    return <SlidersHorizontal className="size-5" />;
  }
  if (action.kind === "back") {
    return <ArrowLeft className="size-5" />;
  }
  if (action.kind === "chat") {
    return <MessageSquare className="size-5" />;
  }
  if (action.kind === "report") {
    return <FileText className="size-5" />;
  }
  return <Plus className="size-5" />;
}

function IslandIconButton({
  children,
  ariaLabel,
  onClick,
}: {
  readonly children: ReactNode;
  readonly ariaLabel: string;
  readonly onClick: () => void;
}) {
  return (
    <div className={ICON_SLOT_CLASS}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={ariaLabel}
        onClick={onClick}
        className={ICON_BUTTON_CLASS}
      >
        {children}
      </Button>
    </div>
  );
}

function IslandLabelButton({
  children,
  label,
  ariaLabel,
  onClick,
}: {
  readonly children: ReactNode;
  readonly label: string;
  readonly ariaLabel: string;
  readonly onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "h-12 min-w-0 w-full gap-1.5 rounded-full px-2 text-foreground",
        "hover:bg-foreground/10 active:bg-foreground/15",
      )}
    >
      {children}
      {label ? (
        <span className="truncate text-sm font-medium">{label}</span>
      ) : null}
    </Button>
  );
}
