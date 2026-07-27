"use client";

import { ImageUp, ScanLine } from "lucide-react";
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

/** Opens a camera/image QR scanner and approves the scanned sign-in in place. */
export function ScanQrButton({ onResolved }: { readonly onResolved?: () => void }) {
  const t = useTranslations("qrApproval");
  const [open, setOpen] = useState(false);
  const [scannedToken, setScannedToken] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
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

  useEffect(() => {
    if (!open || scannedToken) {
      return;
    }
    const videoElement = videoRef.current;
    if (!videoElement) {
      return;
    }

    let cancelled = false;
    setCameraError(false);

    async function startScanner() {
      try {
        const QrScanner = (await import("qr-scanner")).default;
        if (cancelled) {
          return;
        }
        const scanner = new QrScanner(
          videoElement!,
          (result: { data: string }) => handleDecodedText(result.data),
          { highlightScanRegion: true, highlightCodeOutline: true },
        );
        scannerRef.current = scanner;
        await scanner.start();
      } catch {
        if (!cancelled) {
          setCameraError(true);
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
  }, [open, scannedToken, handleDecodedText]);

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
    setCameraError(false);
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
              <div className="overflow-hidden rounded-2xl border border-border/60 bg-black/40">
                <video
                  ref={videoRef}
                  className="aspect-square w-full object-cover"
                  playsInline
                  muted
                />
              </div>
              {cameraError ? (
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
