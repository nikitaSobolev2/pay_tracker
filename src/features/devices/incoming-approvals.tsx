"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { ApprovalPanel } from "@/features/auth/approval-panel";
import {
  getIncomingApprovals,
  type IncomingApprovalDto,
} from "@/lib/api/qr-approval";

const POLL_INTERVAL_MS = 3000;

/** Push flow: pending sign-in requests waiting for this owner's approval. */
export function IncomingApprovals() {
  const t = useTranslations("qrApproval");
  const [items, setItems] = useState<IncomingApprovalDto[]>([]);

  const load = useCallback(async () => {
    try {
      setItems(await getIncomingApprovals());
    } catch {
      // Polling failures are transient; keep the last known list.
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {t("incomingTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("incomingHint")}
        </p>
      </div>
      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.id}>
            <ApprovalPanel
              approvalId={item.id}
              initialInfo={{
                status: "pending",
                requesterUserAgent: item.requesterUserAgent,
                requesterIp: item.requesterIp,
                createdAt: item.createdAt,
                expiresAt: item.expiresAt,
                bound: true,
              }}
              onResolved={() => void load()}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
