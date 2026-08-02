"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
import { analyzeEvent } from "@/lib/api/events";
import { cn } from "@/lib/utils";
import { AppLocale } from "@/types/enums";

import {
  AI_BUTTON_INNER_CLASS,
  AI_BUTTON_SHELL_CLASS,
  AI_RAINBOW_BORDER_STYLE,
  AI_RAINBOW_GRADIENT,
  AI_RAINBOW_TEXT_CLASS,
  AI_RAINBOW_TEXT_STYLE,
} from "./ai-styles";

export type EventAiAnalyzeDialogProps = {
  readonly open: boolean;
  readonly eventId: string;
  readonly hasReport: boolean;
  readonly lastResponseLocale: string | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onCompleted: () => Promise<void>;
};

function resolveDefaultLocale(
  lastResponseLocale: string | null,
  userLocale: string,
): AppLocale {
  const candidate = lastResponseLocale ?? userLocale;
  return candidate.startsWith("ru") ? AppLocale.Ru : AppLocale.En;
}

export function EventAiAnalyzeDialog({
  open,
  eventId,
  hasReport,
  lastResponseLocale,
  onOpenChange,
  onCompleted,
}: EventAiAnalyzeDialogProps) {
  const t = useTranslations("events");
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
    setRunning(true);
    try {
      await analyzeEvent(eventId, { contextMessage, responseLocale });
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
                {t("aiAnalyzeTitle")}
              </span>
            </DialogTitle>
          </ResponsiveDialogHeaderInner>
          <div className="pb-3" />
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody className="space-y-4">
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
              <div className="space-y-2">
                <Label id="ai-response-locale-label">{t("aiLanguageLabel")}</Label>
                <div
                  role="group"
                  aria-labelledby="ai-response-locale-label"
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
                    {t("aiLanguageEn")}
                  </Button>
                  <Button
                    type="button"
                    variant={
                      responseLocale === AppLocale.Ru ? "default" : "outline"
                    }
                    className="h-12 rounded-xl text-base md:h-10 md:text-sm"
                    onClick={() => setResponseLocale(AppLocale.Ru)}
                  >
                    {t("aiLanguageRu")}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("aiContextLabel")}</Label>
                <Textarea
                  className="min-h-28 rounded-xl text-base md:text-sm"
                  placeholder={t("aiContextPlaceholder")}
                  value={contextMessage}
                  onChange={(event) => setContextMessage(event.target.value)}
                />
              </div>
            </>
          )}
        </ResponsiveDialogBody>

        <ResponsiveDialogFooter>
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full rounded-xl text-base sm:w-auto md:h-10"
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
