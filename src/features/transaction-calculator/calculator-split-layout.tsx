"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useDefaultLayout } from "react-resizable-panels";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { cn } from "@/lib/utils";

const LG_QUERY = "(min-width: 1024px)";
const SOURCE_PANEL_ID = "source";
const PEOPLE_PANEL_ID = "people";

type CalculatorSplitLayoutProps = {
  readonly source: ReactNode;
  readonly people: ReactNode;
};

export function CalculatorSplitLayout({
  source,
  people,
}: CalculatorSplitLayoutProps) {
  const desktop = useDesktopLayout();
  if (desktop == null) {
    return <SplitFallback source={source} people={people} />;
  }
  return (
    <CalculatorSplitGroup
      key={desktop ? "desktop" : "mobile"}
      desktop={desktop}
      source={source}
      people={people}
    />
  );
}

function useDesktopLayout(): boolean | null {
  const [desktop, setDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    const media = window.matchMedia(LG_QUERY);
    const sync = () => setDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return desktop;
}

function SplitFallback({ source, people }: CalculatorSplitLayoutProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
      <PaneFrame className="h-1/2 lg:h-auto lg:flex-1">{source}</PaneFrame>
      <PaneFrame className="flex-1">{people}</PaneFrame>
    </div>
  );
}

function CalculatorSplitGroup({
  desktop,
  source,
  people,
}: CalculatorSplitLayoutProps & { readonly desktop: boolean }) {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: desktop
      ? "paytracker:calculator-split:desktop"
      : "paytracker:calculator-split:mobile",
    storage: splitLayoutStorage(),
    onlySaveAfterUserInteractions: true,
  });
  return (
    <ResizablePanelGroup
      orientation={desktop ? "horizontal" : "vertical"}
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
      className="min-h-0 flex-1"
      resizeTargetMinimumSize={{ coarse: 28, fine: 10 }}
    >
      <ResizablePanel
        id={SOURCE_PANEL_ID}
        defaultSize="50%"
        minSize="20%"
        className="min-h-0 min-w-0 overflow-hidden"
      >
        <PaneFrame>{source}</PaneFrame>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel
        id={PEOPLE_PANEL_ID}
        defaultSize="50%"
        minSize="20%"
        className="min-h-0 min-w-0 overflow-hidden"
      >
        <PaneFrame>{people}</PaneFrame>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function PaneFrame({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-col overflow-hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

function splitLayoutStorage(): {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
} {
  if (typeof window === "undefined") {
    return {
      getItem: () => null,
      setItem: () => undefined,
    };
  }
  return window.localStorage;
}
