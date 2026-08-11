import { useSyncExternalStore } from "react";

/**
 * False on the server and during hydration; true only after the client commits.
 * Use to defer Base UI / useId-heavy chrome so SSR HTML matches the first client paint
 * (Next.js 16.2+ often mismatches library-generated ids otherwise).
 */
export function useHasHydrated(): boolean {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
}
