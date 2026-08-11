"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { CoverImageField } from "@/components/cover-image-field";
import { DateRangeSchedulePicker } from "@/components/date-range-schedule-picker";
import {
  PlaceCityCountryPicker,
  type PlaceValue,
} from "@/components/place-city-country-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogHeaderInner,
} from "@/components/ui/responsive-dialog";
import { uploadTravelCover } from "@/lib/api/travels";
import { isNetworkError } from "@/lib/offline/travel-offline-execute";
import { storeFileForOffline } from "@/lib/offline/travel-offline-files";
import { enqueueTravelOp } from "@/lib/offline/travel-offline-sync";
import { useTravelCacheStore } from "@/stores/travel-cache.store";

import { useTravelScheduleLabel } from "./use-travel-schedule-label";

export type TravelFormValues = {
  readonly title: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly imageUrl: string;
  readonly placeCountry: string;
  readonly placeCity: string;
  readonly placeLabel: string;
};

export type TravelFormDialogProps = {
  readonly open: boolean;
  readonly mode: "create" | "edit";
  readonly travelId?: string;
  readonly initialValues: TravelFormValues;
  readonly saving: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (values: TravelFormValues) => Promise<void>;
};

export function emptyTravelFormValues(): TravelFormValues {
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    title: "",
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    imageUrl: "",
    placeCountry: "",
    placeCity: "",
    placeLabel: "",
  };
}

export function TravelFormDialog({
  open,
  mode,
  travelId,
  initialValues,
  saving,
  onOpenChange,
  onSubmit,
}: TravelFormDialogProps) {
  const t = useTranslations("travels");
  const tCommon = useTranslations("common");
  const formatSchedule = useTravelScheduleLabel();
  const [values, setValues] = useState(initialValues);
  const [loadedValues, setLoadedValues] = useState(initialValues);

  async function uploadCover(file: File): Promise<{ url: string }> {
    try {
      return await uploadTravelCover(file);
    } catch (error) {
      if (!travelId || (!isNetworkError(error) && navigator.onLine)) {
        throw error;
      }
      const fileId = await storeFileForOffline(file);
      const previewUrl = URL.createObjectURL(file);
      enqueueTravelOp({
        travelId,
        op: {
          kind: "uploadCover",
          fileId,
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
        },
      });
      useTravelCacheStore.getState().patchTravel(travelId, (current) => ({
        ...current,
        imageUrl: previewUrl,
      }));
      return { url: previewUrl };
    }
  }

  if (open && loadedValues !== initialValues) {
    setLoadedValues(initialValues);
    setValues(initialValues);
  }

  const placeValue: PlaceValue | null = values.placeCountry
    ? {
        placeCountry: values.placeCountry,
        placeCity: values.placeCity,
        placeLabel: values.placeLabel,
      }
    : null;

  async function handleSubmit() {
    if (!values.title.trim()) {
      toast.error(t("titleRequired"));
      return;
    }
    await onSubmit({
      ...values,
      title: values.title.trim(),
      imageUrl: values.imageUrl.trim(),
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setValues(initialValues);
        }
        onOpenChange(next);
      }}
    >
      <ResponsiveDialogContent className="sm:max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogHeaderInner>
            <DialogTitle>
              {mode === "create" ? t("createTitle") : t("editTitle")}
            </DialogTitle>
          </ResponsiveDialogHeaderInner>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="travel-title">{t("titleField")}</Label>
            <Input
              id="travel-title"
              value={values.title}
              placeholder={t("titlePlaceholder")}
              className="h-12 rounded-xl text-base md:h-11"
              onChange={(event) =>
                setValues((prev) => ({ ...prev, title: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>{t("date")}</Label>
            <DateRangeSchedulePicker
              requireEnd
              value={{ startsAt: values.startsAt, endsAt: values.endsAt }}
              onChange={(next) =>
                setValues((prev) => ({
                  ...prev,
                  startsAt: next.startsAt,
                  endsAt: next.endsAt ?? prev.endsAt,
                }))
              }
              formatLabel={formatSchedule}
              title={t("date")}
              startLabel={t("scheduleStart")}
              endLabel={t("scheduleEnd")}
              addEndLabel={t("scheduleAddEnd")}
              removeEndLabel={t("scheduleRemoveEnd")}
            />
          </div>

          <CoverImageField
            value={values.imageUrl}
            onChange={(imageUrl) => setValues((prev) => ({ ...prev, imageUrl }))}
            onUpload={uploadCover}
            label={t("cover")}
            dropHint={t("coverDropHint")}
            formatsHint={t("coverFormats")}
            removeLabel={t("coverRemove")}
            uploadFailedLabel={t("uploadFailed")}
          />

          <PlaceCityCountryPicker
            value={placeValue}
            onChange={(place) =>
              setValues((prev) => ({
                ...prev,
                placeCountry: place?.placeCountry ?? "",
                placeCity: place?.placeCity ?? "",
                placeLabel: place?.placeLabel ?? "",
              }))
            }
          />
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            className="h-11 rounded-xl"
            disabled={saving}
            onClick={() => void handleSubmit()}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {tCommon("save")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
