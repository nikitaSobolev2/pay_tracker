"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useReadableDateTime } from "@/hooks/use-readable-date-time";
import { authClient } from "@/lib/auth-client";
import { isSessionActive } from "@/lib/session-activity";
import { cn } from "@/lib/utils";

type SessionRow = {
  readonly id: string;
  readonly token: string;
  readonly createdAt: Date | string;
  readonly updatedAt: Date | string;
  readonly expiresAt: Date | string;
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
};

export function DevicesSessionsList() {
  const t = useTranslations("devices");
  const formatReadableDateTime = useReadableDateTime();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const [sessionResult, listResult] = await Promise.all([
        authClient.getSession(),
        authClient.listSessions(),
      ]);
      if (listResult.error) {
        throw new Error(listResult.error.message ?? t("sessionsLoadFailed"));
      }
      setCurrentToken(sessionResult.data?.session?.token ?? null);
      setCurrentSessionId(sessionResult.data?.session?.id ?? null);
      setSessions((listResult.data ?? []) as SessionRow[]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("sessionsLoadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  async function handleRevoke(token: string) {
    setRevokingToken(token);
    try {
      const result = await authClient.revokeSession({ token });
      if (result.error) {
        throw new Error(result.error.message ?? t("revokeFailed"));
      }
      toast.success(t("revokeSuccess"));
      await loadSessions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("revokeFailed"));
    } finally {
      setRevokingToken(null);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {t("sessionsTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("sessionsHint")}
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 px-5 py-10 text-center text-sm text-muted-foreground">
          {t("noSessions")}
        </div>
      ) : (
        <ul className="space-y-3">
          {sessions.map((session) => {
            const isCurrent =
              session.token === currentToken ||
              session.id === currentSessionId;
            const updatedAt = new Date(session.updatedAt);
            const createdAt = new Date(session.createdAt);
            const active = isSessionActive(updatedAt);
            const deviceLabel = describeUserAgent(session.userAgent, t);

            return (
              <li
                key={session.id}
                className="rounded-2xl border border-border/60 bg-card/40 p-4 sm:p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-base font-semibold tracking-tight">
                        {deviceLabel}
                      </p>
                      {isCurrent ? (
                        <Badge variant="secondary">{t("currentSession")}</Badge>
                      ) : null}
                      <Badge
                        variant="secondary"
                        className={cn(
                          active
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {active ? t("statusActive") : t("statusOffline")}
                      </Badge>
                    </div>

                    <dl className="grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-muted-foreground">
                          {t("firstLogin")}
                        </dt>
                        <dd className="font-medium">
                          {formatReadableDateTime(createdAt)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">
                          {t("lastEnter")}
                        </dt>
                        <dd className="font-medium">
                          {formatReadableDateTime(updatedAt)}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-muted-foreground">{t("ipAddress")}</dt>
                        <dd className="font-medium tabular-nums">
                          {session.ipAddress || t("unknownIp")}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <Button
                    type="button"
                    variant="destructive"
                    className="h-12 w-full shrink-0 gap-2 rounded-xl text-base sm:h-10 sm:w-auto sm:text-sm"
                    disabled={isCurrent || revokingToken === session.token}
                    onClick={() => void handleRevoke(session.token)}
                  >
                    {revokingToken === session.token ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Trash2 data-icon="inline-start" />
                    )}
                    {t("terminate")}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function describeUserAgent(
  userAgent: string | null | undefined,
  t: ReturnType<typeof useTranslations<"devices">>,
): string {
  if (!userAgent) {
    return t("unknownDevice");
  }

  const browser =
    matchFirst(userAgent, [
      [/Edg\/[\d.]+/i, "Edge"],
      [/Chrome\/[\d.]+/i, "Chrome"],
      [/Firefox\/[\d.]+/i, "Firefox"],
      [/Safari\/[\d.]+/i, "Safari"],
    ]) ?? t("unknownBrowser");

  const os =
    matchFirst(userAgent, [
      [/Windows NT/i, "Windows"],
      [/Mac OS X/i, "macOS"],
      [/Android/i, "Android"],
      [/iPhone|iPad/i, "iOS"],
      [/Linux/i, "Linux"],
    ]) ?? t("unknownOs");

  return `${browser} · ${os}`;
}

function matchFirst(
  value: string,
  rules: Array<[RegExp, string]>,
): string | null {
  for (const [pattern, label] of rules) {
    if (pattern.test(value)) {
      return label;
    }
  }
  return null;
}
