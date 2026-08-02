"use client";

import { ImageUp, Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/ui/dropzone";
import { Label } from "@/components/ui/label";
import { uploadEventCover } from "@/lib/api/events";

export type EventCoverFieldProps = {
  readonly value: string;
  /** Present when editing, so guests with edit rights may upload too. */
  readonly eventId?: string | null;
  readonly onChange: (imageUrl: string) => void;
};

const ACCEPTED_TYPES = "image/png,image/jpeg,image/webp,image/gif";

export function EventCoverField({
  value,
  eventId = null,
  onChange,
}: EventCoverFieldProps) {
  const t = useTranslations("events");
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    try {
      const result = await uploadEventCover(file, eventId);
      onChange(result.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label>{t("cover")}</Label>
      {value ? (
        <div className="relative overflow-hidden rounded-xl border border-border/60">
          {/* Covers come from the storage subdomain, which next/image would need configured. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-40 w-full object-cover" />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="absolute top-2 right-2 h-9 gap-1.5 rounded-lg"
            onClick={() => onChange("")}
          >
            <Trash2 className="size-4" />
            {t("coverRemove")}
          </Button>
        </div>
      ) : (
        <Dropzone
          accept={ACCEPTED_TYPES}
          disabled={uploading}
          className="min-h-32"
          onFileSelected={(file) => void upload(file)}
        >
          {uploading ? (
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          ) : (
            <ImageUp className="size-6 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">{t("coverDropHint")}</span>
          <span className="text-xs text-muted-foreground">
            {t("coverFormats")}
          </span>
        </Dropzone>
      )}
    </div>
  );
}
