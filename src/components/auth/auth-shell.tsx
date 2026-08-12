import type { ReactNode } from "react";

type AuthShellProps = {
  brand: string;
  title: string;
  children: ReactNode;
};

export function AuthShell({ brand, title, children }: AuthShellProps) {
  return (
    <div className="flex min-h-svh items-center justify-center px-4 py-8 sm:px-6">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 text-center sm:mb-10">
          <p className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {brand}
          </p>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            {title}
          </p>
        </div>
        <div className="rounded-xl border border-border/70 bg-card p-5 sm:p-7">
          {children}
        </div>
      </div>
    </div>
  );
}
