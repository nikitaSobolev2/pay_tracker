"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogHeaderInner,
} from "@/components/ui/responsive-dialog";
import { Textarea } from "@/components/ui/textarea";
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

  return (
    <div className="flex flex-wrap gap-2">
      {travel.aiReport ? (
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-xl"
          onClick={() => setReportOpen(true)}
        >
          {t("aiViewReport")}
        </Button>
      ) : null}
      <Button
        type="button"
        className="h-11 gap-1.5 rounded-xl"
        onClick={() => setAnalyzeOpen(true)}
      >
        <Sparkles className="size-4" />
        {travel.aiReport ? t("aiReanalyze") : t("aiAnalyze")}
      </Button>

      <TravelAiAnalyzeDialog
        open={analyzeOpen}
        travelId={travel.id}
        lastResponseLocale={travel.aiReport?.responseLocale ?? null}
        onOpenChange={setAnalyzeOpen}
        onCompleted={async () => {
          await onRefresh();
          setReportOpen(true);
        }}
      />

      {travel.aiReport ? (
        <TravelAiReportModal
          open={reportOpen}
          reportMessage={travel.aiReport.reportMessage}
          type={travel.aiReport.type}
          onOpenChange={setReportOpen}
        />
      ) : null}
    </div>
  );
}

function TravelAiAnalyzeDialog({
  open,
  travelId,
  lastResponseLocale,
  onOpenChange,
  onCompleted,
}: {
  readonly open: boolean;
  readonly travelId: string;
  readonly lastResponseLocale: string | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onCompleted: () => Promise<void>;
}) {
  const t = useTranslations("travels");
  const tCommon = useTranslations("common");
  const userLocale = useLocale();
  const [contextMessage, setContextMessage] = useState("");
  const defaultLocale = (lastResponseLocale ?? userLocale).startsWith("ru")
    ? AppLocale.Ru
    : AppLocale.En;
  const [responseLocale, setResponseLocale] = useState<AppLocale>(defaultLocale);
  const [syncedOpen, setSyncedOpen] = useState(false);
  const [running, setRunning] = useState(false);

  if (open && !syncedOpen && !running) {
    setSyncedOpen(true);
    setResponseLocale(defaultLocale);
  }
  if (!open && syncedOpen) {
    setSyncedOpen(false);
  }

  async function run() {
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
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogHeaderInner>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5" />
              {t("aiAnalyze")}
            </DialogTitle>
          </ResponsiveDialogHeaderInner>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody className="space-y-4">
          <div className="space-y-2">
            <Label>{t("aiLanguage")}</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={responseLocale === AppLocale.En ? "default" : "outline"}
                className="h-11 rounded-xl"
                onClick={() => setResponseLocale(AppLocale.En)}
              >
                EN
              </Button>
              <Button
                type="button"
                variant={responseLocale === AppLocale.Ru ? "default" : "outline"}
                className="h-11 rounded-xl"
                onClick={() => setResponseLocale(AppLocale.Ru)}
              >
                RU
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("aiContext")}</Label>
            <Textarea
              value={contextMessage}
              className="min-h-28 rounded-xl"
              onChange={(event) => setContextMessage(event.target.value)}
            />
          </div>
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl"
            disabled={running}
            onClick={() => onOpenChange(false)}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            className="h-11 rounded-xl"
            disabled={running}
            onClick={() => void run()}
          >
            {running ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t("aiRunning")}
              </>
            ) : (
              t("aiAnalyze")
            )}
          </Button>
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
      <ResponsiveDialogContent className="sm:max-w-2xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogHeaderInner>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <Sparkles className="size-5" />
              {t("aiReportTitle")}
              <Badge
                variant="outline"
                className={cn(
                  "rounded-lg",
                  isOk
                    ? "border-emerald-500/40 text-emerald-600"
                    : "border-destructive/40 text-destructive",
                )}
              >
                {isOk ? t("aiReportOk") : t("aiReportBad")}
              </Badge>
            </DialogTitle>
          </ResponsiveDialogHeaderInner>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody>
          <div
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
