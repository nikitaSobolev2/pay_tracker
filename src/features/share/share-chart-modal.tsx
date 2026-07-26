"use client";

import { Check, Copy, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogHeaderInner,
} from "@/components/ui/responsive-dialog";
import { createShare, updateShare } from "@/lib/api/shares";
import { cn } from "@/lib/utils";
import { useShareChartStore } from "@/stores/share-chart.store";

export function ShareChartModal() {
  const t = useTranslations("share");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const open = useShareChartStore((state) => state.open);
  const payload = useShareChartStore((state) => state.payload);
  const initialTitle = useShareChartStore((state) => state.initialTitle);
  const closeShare = useShareChartStore((state) => state.closeShare);

  const [shareId, setShareId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !payload) {
      return;
    }
    let cancelled = false;
    setCreating(true);
    setShareId(null);
    setTitle(initialTitle);
    setCopied(false);
    createShare({
      title: initialTitle || null,
      payload,
    })
      .then((share) => {
        if (!cancelled) {
          setShareId(share.id);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : t("createFailed"),
          );
          closeShare();
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCreating(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, payload, initialTitle, closeShare, t]);

  const shareUrl =
    shareId && typeof window !== "undefined"
      ? `${window.location.origin}/${locale}/share/${shareId}`
      : "";

  async function handleCopy() {
    if (!shareUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error(t("copyFailed"));
    }
  }

  async function handlePublish() {
    if (!shareId) {
      return;
    }
    setPublishing(true);
    try {
      await updateShare(shareId, {
        title: title.trim() || null,
        isPublic: true,
      });
      toast.success(t("published"));
      closeShare();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("publishFailed"));
    } finally {
      setPublishing(false);
    }
  }

  async function handleTitleBlur() {
    if (!shareId) {
      return;
    }
    try {
      await updateShare(shareId, { title: title.trim() || null });
    } catch {
      // Title can be fixed before publish; ignore quiet failures.
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          closeShare();
        }
      }}
    >
      <ResponsiveDialogContent size="md" showCloseButton>
        <ResponsiveDialogHeader>
          <ResponsiveDialogHeaderInner>
            <DialogTitle className="text-xl font-semibold tracking-tight">
              {t("shareChart")}
            </DialogTitle>
          </ResponsiveDialogHeaderInner>
          <div className="pb-3" />
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody className="space-y-4">
          <div className="space-y-2">
            <label
              className="text-sm font-medium"
              htmlFor="share-title"
            >
              {t("titleOptional")}
            </label>
            <Input
              id="share-title"
              className="h-12 rounded-xl text-base md:h-11"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => {
                void handleTitleBlur();
              }}
              placeholder={t("titlePlaceholder")}
              maxLength={120}
              disabled={creating || !shareId}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="share-link">
              {t("link")}
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="share-link"
                readOnly
                value={creating ? t("creatingLink") : shareUrl}
                className="h-12 rounded-xl font-mono text-xs md:h-11"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-12 shrink-0 rounded-xl md:size-11"
                aria-label={t("copy")}
                disabled={!shareUrl || creating}
                onClick={() => {
                  void handleCopy();
                }}
              >
                <span className="relative inline-flex size-4 items-center justify-center">
                  <Copy
                    className={cn(
                      "absolute size-4 transition-all duration-200",
                      copied
                        ? "scale-50 opacity-0"
                        : "scale-100 opacity-100",
                    )}
                  />
                  <Check
                    className={cn(
                      "absolute size-4 text-emerald-400 transition-all duration-200",
                      copied
                        ? "scale-100 opacity-100"
                        : "scale-50 opacity-0",
                    )}
                  />
                </span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t("publicHint")}</p>
          </div>
        </ResponsiveDialogBody>

        <ResponsiveDialogFooter>
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full rounded-xl text-base sm:w-auto md:h-10"
            onClick={closeShare}
            disabled={publishing}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            className="h-12 w-full rounded-xl text-base sm:w-auto md:h-10"
            onClick={() => {
              void handlePublish();
            }}
            disabled={!shareId || creating || publishing}
          >
            {publishing ? <Loader2 className="animate-spin" /> : null}
            {publishing ? t("publishing") : t("makePublic")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
