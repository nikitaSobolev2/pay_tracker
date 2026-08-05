"use client";

import { ImagePlus, Loader2, Send, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, type ClipboardEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadEventAttachment } from "@/lib/api/events";
import { cn } from "@/lib/utils";

export type MessageComposerPayload = {
  readonly body: string;
  readonly imageUrl: string | null;
};

export type MessageComposerProps = {
  readonly eventId: string;
  readonly value: string;
  readonly placeholder: string;
  readonly disabled?: boolean;
  readonly sendLabel: string;
  readonly attachLabel: string;
  readonly className?: string;
  readonly inputClassName?: string;
  readonly buttonClassName?: string;
  readonly onChange: (value: string) => void;
  readonly onSubmit: (payload: MessageComposerPayload) => Promise<void> | void;
};

const ACCEPTED_TYPES = "image/png,image/jpeg,image/webp,image/gif";
const ACCEPTED_MIME = new Set(ACCEPTED_TYPES.split(","));

export function MessageComposer({
  eventId,
  value,
  placeholder,
  disabled = false,
  sendLabel,
  attachLabel,
  className,
  inputClassName,
  buttonClassName,
  onChange,
  onSubmit,
}: MessageComposerProps): ReactNode {
  const t = useTranslations("events");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);

  const busy = disabled || uploading || sending;
  const canSend = Boolean(value.trim() || imageUrl);
  const imageOnly = Boolean(imageUrl);

  async function attach(file: File) {
    setUploading(true);
    try {
      const result = await uploadEventAttachment(file, eventId);
      setImageUrl(result.url);
      onChange("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("uploadFailed"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handlePaste(pasteEvent: ClipboardEvent<HTMLInputElement>) {
    if (busy) {
      return;
    }
    const file = readClipboardImage(pasteEvent.clipboardData);
    if (!file) {
      return;
    }
    pasteEvent.preventDefault();
    void attach(file);
  }

  async function send() {
    if (!canSend || busy) {
      return;
    }
    setSending(true);
    try {
      await onSubmit({
        body: imageUrl ? "" : value.trim(),
        imageUrl,
      });
      onChange("");
      setImageUrl(null);
    } catch {
      // Callers toast the failure; keep draft and attachment.
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={cn("w-full space-y-2", className)}>
      {imageUrl ? (
        <div className="relative w-fit overflow-hidden rounded-xl border border-border/60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            className="h-24 w-auto max-w-48 object-cover"
          />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute top-1 right-1 size-7 rounded-lg"
            aria-label={t("attachRemove")}
            disabled={busy}
            onClick={() => setImageUrl(null)}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ) : null}

      <div className="flex w-full items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={(changeEvent) => {
            const file = changeEvent.target.files?.[0];
            if (file) {
              void attach(file);
            }
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("size-9 shrink-0 rounded-lg", buttonClassName)}
          aria-label={attachLabel}
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ImagePlus className="size-4" />
          )}
        </Button>
        <Input
          className={cn("h-9 rounded-lg", inputClassName)}
          placeholder={imageOnly ? t("attachImageReady") : placeholder}
          value={imageOnly ? "" : value}
          disabled={busy}
          readOnly={imageOnly && !busy}
          onChange={(changeEvent) => onChange(changeEvent.target.value)}
          onPaste={handlePaste}
          onKeyDown={(keyEvent) => {
            if (keyEvent.key === "Enter") {
              keyEvent.preventDefault();
              void send();
            }
          }}
        />
        <Button
          type="button"
          size="icon"
          className={cn("size-9 shrink-0 rounded-lg", buttonClassName)}
          aria-label={sendLabel}
          disabled={busy || !canSend}
          onClick={() => void send()}
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function readClipboardImage(data: DataTransfer | null): File | null {
  if (!data) {
    return null;
  }
  for (const item of data.items) {
    if (item.kind !== "file" || !ACCEPTED_MIME.has(item.type)) {
      continue;
    }
    return item.getAsFile();
  }
  return null;
}
