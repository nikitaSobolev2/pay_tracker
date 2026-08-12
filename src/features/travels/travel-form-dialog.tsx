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
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import {
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogHeaderInner,
} from "@/components/ui/responsive-dialog";
import {
  EventAddressPicker,
  type EventLocationValue,
} from "@/features/events/event-address-picker";
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
  readonly housingAddress: string;
  readonly housingLatitude: number | null;
  readonly housingLongitude: number | null;
  readonly housingFloor: string;
  readonly housingEntrance: string;
  readonly housingApartment: string;
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
    housingAddress: "",
    housingLatitude: null,
    housingLongitude: null,
    housingFloor: "",
    housingEntrance: "",
    housingApartment: "",
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
      housingAddress: values.housingAddress ?? "",
      housingLatitude: values.housingLatitude ?? null,
      housingLongitude: values.housingLongitude ?? null,
      housingFloor: values.housingFloor ?? "",
      housingEntrance: values.housingEntrance ?? "",
      housingApartment: values.housingApartment ?? "",
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
      <ResponsiveDialogContent size="xl" showCloseButton>
        <ResponsiveDialogHeader>
          <ResponsiveDialogHeaderInner>
            <DialogTitle>
              {mode === "create" ? t("createTitle") : t("editTitle")}
            </DialogTitle>
          </ResponsiveDialogHeaderInner>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody>
          <FormField label={t("titleField")} htmlFor="travel-title" required>
            <Input
              id="travel-title"
              value={values.title}
              placeholder={t("titlePlaceholder")}
              required
              onChange={(event) =>
                setValues((prev) => ({ ...prev, title: event.target.value }))
              }
            />
          </FormField>

          <FormField label={t("date")} required>
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
          </FormField>

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
              setValues((prev) => {
                const next = {
                  ...prev,
                  placeCountry: place?.placeCountry ?? "",
                  placeCity: place?.placeCity ?? "",
                  placeLabel: place?.placeLabel ?? "",
                };
                if (
                  place?.latitude == null ||
                  place?.longitude == null ||
                  !Number.isFinite(place.latitude) ||
                  !Number.isFinite(place.longitude)
                ) {
                  return next;
                }
                const housingUnset =
                  prev.housingLatitude == null ||
                  prev.housingLongitude == null ||
                  !prev.housingAddress.trim();
                const housingMatchedPreviousPlace =
                  Boolean(prev.placeLabel) &&
                  prev.housingAddress.trim() === prev.placeLabel.trim();
                if (!housingUnset && !housingMatchedPreviousPlace) {
                  return next;
                }
                return {
                  ...next,
                  housingLatitude: place.latitude,
                  housingLongitude: place.longitude,
                  housingAddress: place.placeLabel || prev.housingAddress,
                };
              })
            }
          />

          <EventAddressPicker
            label={t("housingAddress")}
            mapActive={open}
            zoom={values.placeCity ? 12 : values.placeCountry ? 5 : 15}
            value={{
              address: values.housingAddress ?? "",
              latitude: values.housingLatitude ?? null,
              longitude: values.housingLongitude ?? null,
            }}
            onChange={(location: EventLocationValue) =>
              setValues((prev) => ({
                ...prev,
                housingAddress: location.address,
                housingLatitude: location.latitude,
                housingLongitude: location.longitude,
              }))
            }
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField
              label={t("housingEntrance")}
              htmlFor="travel-housing-entrance"
              optional
            >
              <Input
                id="travel-housing-entrance"
                value={values.housingEntrance}
                placeholder={t("housingEntrancePlaceholder")}
                onChange={(event) =>
                  setValues((prev) => ({
                    ...prev,
                    housingEntrance: event.target.value,
                  }))
                }
              />
            </FormField>
            <FormField
              label={t("housingFloor")}
              htmlFor="travel-housing-floor"
              optional
            >
              <Input
                id="travel-housing-floor"
                value={values.housingFloor}
                placeholder={t("housingFloorPlaceholder")}
                onChange={(event) =>
                  setValues((prev) => ({
                    ...prev,
                    housingFloor: event.target.value,
                  }))
                }
              />
            </FormField>
            <FormField
              label={t("housingApartment")}
              htmlFor="travel-housing-apartment"
              optional
            >
              <Input
                id="travel-housing-apartment"
                value={values.housingApartment}
                placeholder={t("housingApartmentPlaceholder")}
                onChange={(event) =>
                  setValues((prev) => ({
                    ...prev,
                    housingApartment: event.target.value,
                  }))
                }
              />
            </FormField>
          </div>
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
