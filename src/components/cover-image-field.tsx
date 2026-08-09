"use client";

import { ImageUp, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/ui/dropzone";
import { Label } from "@/components/ui/label";

export type CoverImageFieldProps = {
  readonly value: string;
  readonly onChange: (imageUrl: string) => void;
  readonly onUpload: (file: File) => Promise<{ url: string }>;
  readonly label: string;
  readonly dropHint: string;
  readonly formatsHint: string;
  readonly removeLabel: string;
  readonly uploadFailedLabel: string;
};

const ACCEPTED_TYPES = "image/png,image/jpeg,image/webp,image/gif";

export function CoverImageField({
  value,
  onChange,
  onUpload,
  label,
  dropHint,
  formatsHint,
  removeLabel,
  uploadFailedLabel,
}: CoverImageFieldProps) {
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    try {
      const result = await onUpload(file);
      onChange(result.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : uploadFailedLabel);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {value ? (
        <div className="relative overflow-hidden rounded-xl border border-border/60">
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
            {removeLabel}
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
          <span className="text-sm font-medium">{dropHint}</span>
          <span className="text-xs text-muted-foreground">{formatsHint}</span>
        </Dropzone>
      )}
    </div>
  );
}
