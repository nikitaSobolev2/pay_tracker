"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import {
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogHeaderInner,
} from "@/components/ui/responsive-dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  AI_BUTTON_INNER_CLASS,
  AI_BUTTON_SHELL_CLASS,
  AI_RAINBOW_BORDER_STYLE,
  AI_RAINBOW_GRADIENT,
  AI_RAINBOW_TEXT_CLASS,
  AI_RAINBOW_TEXT_STYLE,
} from "@/features/ai/ai-styles";
import { analyzeTravel } from "@/lib/api/travels";
import { renderMarkdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import type { TravelDetailDto } from "@/server/services/travel-service.types";
import { AppLocale, TravelAiReportType } from "@/types/enums";

export function TravelAiControls({
  travel,
  onRefresh,
}: {
  readonly travel: TravelDetailDto;
  readonly onRefresh: () => Promise<void>;
}) {
  const t = useTranslations("travels");
  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const report = travel.aiReport;

  return (
    <div className="flex flex-wrap gap-2">
      {report ? (
        <button
          type="button"
          className={cn(AI_BUTTON_SHELL_CLASS, "h-11 cursor-pointer")}
          style={AI_RAINBOW_BORDER_STYLE}
          onClick={() => setReportOpen(true)}
          aria-label={t("aiViewReport")}
        >
          <span className={cn(AI_BUTTON_INNER_CLASS, "px-3.5")}>
            <Sparkles
              className={cn(
                "size-3.5 shrink-0",
                report.type === TravelAiReportType.Ok
                  ? "text-emerald-400"
                  : "text-destructive",
              )}
            />
            <span>
              {report.type === TravelAiReportType.Ok
                ? t("aiReportOk")
                : t("aiReportBad")}
            </span>
          </span>
        </button>
      ) : null}

      <button
        type="button"
        className={cn(AI_BUTTON_SHELL_CLASS, "h-11 cursor-pointer")}
        style={AI_RAINBOW_BORDER_STYLE}
        onClick={() => setAnalyzeOpen(true)}
      >
        <span className={cn(AI_BUTTON_INNER_CLASS, "px-3.5")}>
          <Sparkles className="size-3.5 shrink-0 text-fuchsia-400" />
          <span>{report ? t("aiReanalyze") : t("aiAnalyze")}</span>
        </span>
      </button>

      <TravelAiAnalyzeDialog
        open={analyzeOpen}
        travelId={travel.id}
        hasReport={report != null}
        lastResponseLocale={report?.responseLocale ?? null}
        onOpenChange={setAnalyzeOpen}
        onCompleted={async () => {
          await onRefresh();
          setReportOpen(true);
        }}
      />

      {report ? (
        <TravelAiReportModal
          open={reportOpen}
          reportMessage={report.reportMessage}
          type={report.type}
          onOpenChange={setReportOpen}
        />
      ) : null}
    </div>
  );
}

function resolveDefaultLocale(
  lastResponseLocale: string | null,
  userLocale: string,
): AppLocale {
  const candidate = lastResponseLocale ?? userLocale;
  return candidate.startsWith("ru") ? AppLocale.Ru : AppLocale.En;
}

function TravelAiAnalyzeDialog({
  open,
  travelId,
  hasReport,
  lastResponseLocale,
  onOpenChange,
  onCompleted,
}: {
  readonly open: boolean;
  readonly travelId: string;
  readonly hasReport: boolean;
  readonly lastResponseLocale: string | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onCompleted: () => Promise<void>;
}) {
  const t = useTranslations("travels");
  const tCommon = useTranslations("common");
  const userLocale = useLocale();
  const [contextMessage, setContextMessage] = useState("");
  const [responseLocale, setResponseLocale] = useState<AppLocale>(() =>
    resolveDefaultLocale(lastResponseLocale, userLocale),
  );
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!open || running) {
      return;
    }
    setResponseLocale(resolveDefaultLocale(lastResponseLocale, userLocale));
  }, [lastResponseLocale, open, running, userLocale]);

  async function run() {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error(t("aiRequiresOnline"));
      return;
    }
    setRunning(true);
    try {
      await analyzeTravel(travelId, { responseLocale, contextMessage });
      await onCompleted();
      onOpenChange(false);
      setContextMessage("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("aiFailed"));
    } finally {
      setRunning(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!running) {
          onOpenChange(next);
        }
      }}
    >
      <ResponsiveDialogContent size="md" showCloseButton={!running}>
        <ResponsiveDialogHeader>
          <ResponsiveDialogHeaderInner>
            <DialogTitle className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              <Sparkles className="size-5 text-fuchsia-400" />
              <span
                className={AI_RAINBOW_TEXT_CLASS}
                style={AI_RAINBOW_TEXT_STYLE}
              >
                {t("aiAnalyze")}
              </span>
            </DialogTitle>
          </ResponsiveDialogHeaderInner>
          <div className="pb-3" />
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody>
          {running ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div
                className={cn(
                  "size-12 rounded-full ai-rainbow-running",
                  "opacity-90",
                )}
                style={{ backgroundImage: AI_RAINBOW_GRADIENT }}
              />
              <p
                className={cn("text-sm font-medium", AI_RAINBOW_TEXT_CLASS)}
                style={AI_RAINBOW_TEXT_STYLE}
              >
                {t("aiRunning")}
              </p>
            </div>
          ) : (
            <>
              <FormField
                label={t("aiLanguage")}
                labelId="travel-ai-response-locale-label"
                required
              >
                <div
                  role="group"
                  aria-labelledby="travel-ai-response-locale-label"
                  className="grid grid-cols-2 gap-2"
                >
                  <Button
                    type="button"
                    variant={
                      responseLocale === AppLocale.En ? "default" : "outline"
                    }
                    className="h-12 rounded-xl text-base md:h-10 md:text-sm"
                    onClick={() => setResponseLocale(AppLocale.En)}
                  >
                    EN
                  </Button>
                  <Button
                    type="button"
                    variant={
                      responseLocale === AppLocale.Ru ? "default" : "outline"
                    }
                    className="h-12 rounded-xl text-base md:h-10 md:text-sm"
                    onClick={() => setResponseLocale(AppLocale.Ru)}
                  >
                    RU
                  </Button>
                </div>
              </FormField>
              <FormField label={t("aiContext")} optional>
                <Textarea
                  value={contextMessage}
                  className="min-h-28 rounded-xl text-base md:text-sm"
                  onChange={(event) => setContextMessage(event.target.value)}
                />
              </FormField>
            </>
          )}
        </ResponsiveDialogBody>

        <ResponsiveDialogFooter>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-xl text-base sm:w-auto"
            disabled={running}
            onClick={() => onOpenChange(false)}
          >
            {tCommon("cancel")}
          </Button>
          <button
            type="button"
            className={cn(
              AI_BUTTON_SHELL_CLASS,
              "h-12 w-full cursor-pointer disabled:pointer-events-none disabled:opacity-50 sm:h-10 sm:w-auto",
            )}
            style={AI_RAINBOW_BORDER_STYLE}
            disabled={running}
            onClick={() => void run()}
          >
            <span
              className={cn(
                AI_BUTTON_INNER_CLASS,
                "h-full w-full justify-center px-4 text-base md:text-sm",
              )}
            >
              {running ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-fuchsia-400" />
              ) : (
                <Sparkles className="size-4 shrink-0 text-fuchsia-400" />
              )}
              <span>{hasReport ? t("aiReanalyze") : t("aiAnalyze")}</span>
            </span>
          </button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}

function TravelAiReportModal({
  open,
  reportMessage,
  type,
  onOpenChange,
}: {
  readonly open: boolean;
  readonly reportMessage: string;
  readonly type: TravelAiReportType;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("travels");
  const isOk = type === TravelAiReportType.Ok;
  const html = renderMarkdown(reportMessage);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent size="xl" showCloseButton>
        <ResponsiveDialogHeader>
          <ResponsiveDialogHeaderInner>
            <DialogTitle className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight">
              <Sparkles className="size-5 text-fuchsia-400" />
              <span
                className={AI_RAINBOW_TEXT_CLASS}
                style={AI_RAINBOW_TEXT_STYLE}
              >
                {t("aiReportTitle")}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "rounded-full text-xs",
                  isOk
                    ? "border-emerald-500/40 text-emerald-400"
                    : "border-destructive/40 text-destructive",
                )}
              >
                {isOk ? t("aiReportOk") : t("aiReportBad")}
              </Badge>
            </DialogTitle>
          </ResponsiveDialogHeaderInner>
          <div className="pb-3" />
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody>
          <div
            className="prose prose-sm dark:prose-invert max-w-none space-y-3 text-sm leading-relaxed [&_a]:text-primary [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base [&_li]:my-0.5 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
