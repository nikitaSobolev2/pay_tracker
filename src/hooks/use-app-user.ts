"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchMe, updatePreferences } from "@/lib/api/settings";
import { getBrowserTimezone } from "@/lib/dates";
import type { AppUser } from "@/types/auth";

type UseAppUserResult = {
  user: AppUser | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useAppUser(): UseAppUserResult {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timezoneSyncedRef = useRef(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchMe();
      let nextUser = result.user;

      if (!timezoneSyncedRef.current && nextUser.timezone === "UTC") {
        const browserTimezone = getBrowserTimezone();
        if (browserTimezone !== "UTC") {
          const updated = await updatePreferences({
            timezone: browserTimezone,
          });
          nextUser = updated.user;
        }
        timezoneSyncedRef.current = true;
      } else {
        timezoneSyncedRef.current = true;
      }

      setUser(nextUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load user");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { user, loading, error, refresh };
}
