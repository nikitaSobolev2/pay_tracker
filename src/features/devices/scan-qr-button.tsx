"use client";

import { ImageUp, Loader2, ScanLine } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import {
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogHeaderInner,
} from "@/components/ui/responsive-dialog";
import { ApprovalPanel } from "@/features/auth/approval-panel";
import { parseApprovalToken } from "@/lib/qr-approval";

type QrScannerInstance = {
  start: () => Promise<void>;
  stop: () => void;
  destroy: () => void;
};

type CameraPhase = "idle" | "starting" | "ready" | "denied";

/** Opens a camera/image QR scanner and approves the scanned sign-in in place. */
export function ScanQrButton({
  onResolved,
}: {
  readonly onResolved?: () => void;
}) {
  const t = useTranslations("qrApproval");
  const [open, setOpen] = useState(false);
  const [scannedToken, setScannedToken] = useState<string | null>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [cameraPhase, setCameraPhase] = useState<CameraPhase>("idle");
  const scannerRef = useRef<QrScannerInstance | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDecodedText = useCallback(
    (text: string) => {
      const token = parseApprovalToken(text);
      if (!token) {
        toast.error(t("invalidQr"));
        return;
      }
      setScannedToken(token);
    },
    [t],
  );

  // Base UI portals unmount dialog content while closed, so the <video> only
  // appears after open — wait for the callback ref instead of racing useEffect.
  useEffect(() => {
    if (!open || scannedToken || !videoEl) {
      return;
    }

    let cancelled = false;
    setCameraPhase("starting");

    async function startScanner() {
      try {
        const QrScanner = (await import("qr-scanner")).default;
        if (cancelled || !videoEl) {
          return;
        }
        const scanner = new QrScanner(
          videoEl,
          (result: { data: string }) => handleDecodedText(result.data),
          {
            preferredCamera: "environment",
            highlightScanRegion: true,
            highlightCodeOutline: true,
            returnDetailedScanResult: true,
          },
        );
        scannerRef.current = scanner;
        await scanner.start();
        if (!cancelled) {
          setCameraPhase("ready");
        }
      } catch {
        if (!cancelled) {
          setCameraPhase("denied");
        }
      }
    }

    void startScanner();

    return () => {
      cancelled = true;
      scannerRef.current?.stop();
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, [open, scannedToken, videoEl, handleDecodedText]);

  async function handleImageFile(file: File | null) {
    if (!file) {
      return;
    }
    try {
      const QrScanner = (await import("qr-scanner")).default;
      const result = await QrScanner.scanImage(file, {
        returnDetailedScanResult: true,
      });
      handleDecodedText(result.data);
    } catch {
      toast.error(t("invalidQr"));
    }
  }

  function reset() {
    setScannedToken(null);
    setCameraPhase("idle");
    setVideoEl(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          reset();
        }
      }}
    >
      <Button
        type="button"
        variant="outline"
        className="h-12 w-full gap-2 rounded-xl text-base sm:h-11 sm:w-auto"
        onClick={() => setOpen(true)}
      >
        <ScanLine data-icon="inline-start" />
        {t("scanQr")}
      </Button>

      <ResponsiveDialogContent size="md" showCloseButton>
        <ResponsiveDialogHeader>
          <ResponsiveDialogHeaderInner>
            <DialogTitle className="text-xl font-semibold tracking-tight">
              {scannedToken ? t("approveTitle") : t("scanQr")}
            </DialogTitle>
          </ResponsiveDialogHeaderInner>
          <div className="pb-3" />
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody>
          {scannedToken ? (
            <ApprovalPanel
              token={scannedToken}
              onResolved={() => onResolved?.()}
            />
          ) : (
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-black">
                <video
                  ref={setVideoEl}
                  className="aspect-square w-full object-cover"
                  playsInline
                  muted
                  autoPlay
                />
                {cameraPhase === "starting" || cameraPhase === "idle" ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-white">
                    <Loader2 className="size-7 animate-spin" />
                    <p className="text-sm">{t("startingCamera")}</p>
                  </div>
                ) : null}
              </div>
              {cameraPhase === "denied" ? (
                <p className="text-sm text-muted-foreground">
                  {t("cameraDenied")}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("scanCameraHint")}
                </p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  void handleImageFile(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full gap-2 rounded-xl text-base sm:h-11"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageUp data-icon="inline-start" />
                {t("scanFromImage")}
              </Button>
            </div>
          )}
        </ResponsiveDialogBody>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
