"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { EventAiReportType, EventAuthorRole } from "@/types/enums";

import { useEventContext } from "../event-context";
import {
  AI_BUTTON_INNER_CLASS,
  AI_BUTTON_SHELL_CLASS,
  AI_RAINBOW_BORDER_STYLE,
} from "./ai-styles";
import { EventAiAnalyzeDialog } from "./event-ai-analyze-dialog";
import { EventAiReportModal } from "./event-ai-report-modal";

export function EventAiControls() {
  const t = useTranslations("events");
  const { event, viewer, refreshEvent } = useEventContext();
  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const isOwner = viewer.role === EventAuthorRole.Owner;
  const report = event.aiReport;

  return (
    <>
      {report ? (
        <button
          type="button"
          className={cn(AI_BUTTON_SHELL_CLASS, "cursor-pointer")}
          style={AI_RAINBOW_BORDER_STYLE}
          onClick={() => setReportOpen(true)}
          aria-label={t("aiViewReport")}
        >
          <span className={AI_BUTTON_INNER_CLASS}>
            <Sparkles
              className={cn(
                "size-3.5 shrink-0",
                report.type === EventAiReportType.Ok
                  ? "text-emerald-400"
                  : "text-destructive",
              )}
            />
            <span>
              {report.type === EventAiReportType.Ok
                ? t("aiReportOk")
                : t("aiReportBad")}
            </span>
          </span>
        </button>
      ) : null}

      {isOwner ? (
        <button
          type="button"
          className={cn(AI_BUTTON_SHELL_CLASS, "cursor-pointer")}
          style={AI_RAINBOW_BORDER_STYLE}
          onClick={() => setAnalyzeOpen(true)}
        >
          <span className={AI_BUTTON_INNER_CLASS}>
            <Sparkles className="size-3.5 shrink-0 text-fuchsia-400" />
            <span>{report ? t("aiReanalyze") : t("aiAnalyze")}</span>
          </span>
        </button>
      ) : null}

      {isOwner ? (
        <EventAiAnalyzeDialog
          open={analyzeOpen}
          eventId={event.id}
          hasReport={report !== null}
          lastResponseLocale={report?.responseLocale ?? null}
          onOpenChange={setAnalyzeOpen}
          onCompleted={async () => {
            await refreshEvent();
            setReportOpen(true);
          }}
        />
      ) : null}

      {report ? (
        <EventAiReportModal
          open={reportOpen}
          report={report}
          onOpenChange={setReportOpen}
        />
      ) : null}
    </>
  );
}
