"use client";

import { useTranslations } from "next-intl";

import { CoverImageField } from "@/components/cover-image-field";
import { uploadEventCover } from "@/lib/api/events";

export type EventCoverFieldProps = {
  readonly value: string;
  readonly eventId?: string | null;
  readonly onChange: (imageUrl: string) => void;
};

export function EventCoverField({
  value,
  eventId = null,
  onChange,
}: EventCoverFieldProps) {
  const t = useTranslations("events");

  return (
    <CoverImageField
      value={value}
      onChange={onChange}
      onUpload={(file) => uploadEventCover(file, eventId)}
      label={t("cover")}
      dropHint={t("coverDropHint")}
      formatsHint={t("coverFormats")}
      removeLabel={t("coverRemove")}
      uploadFailedLabel={t("uploadFailed")}
    />
  );
}
