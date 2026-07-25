import type { ReactNode } from "react";

type AuthShellProps = {
  brand: string;
  title: string;
  children: ReactNode;
};

export function AuthShell({ brand, title, children }: AuthShellProps) {
  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden px-4 py-8 sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.35_0.02_250/_0.35),_transparent_55%),radial-gradient(ellipse_at_bottom,_oklch(0.28_0.01_80/_0.25),_transparent_50%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(to_right,oklch(1_0_0/_0.06)_1px,transparent_1px),linear-gradient(to_bottom,oklch(1_0_0/_0.06)_1px,transparent_1px)] [background-size:40px_40px] dark:opacity-[0.08]"
      />
      <div className="relative z-10 w-full max-w-[420px]">
        <div className="mb-8 text-center sm:mb-10">
          <p className="font-sans text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {brand}
          </p>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            {title}
          </p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-[0_20px_60px_-30px_oklch(0_0_0/_0.55)] backdrop-blur-md sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
