"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { EventGuestPermission, EventPublicity } from "@/types/enums";

import {
  EventAddressPicker,
  type EventLocationValue,
} from "./event-address-picker";
import { EventAttendeePicker } from "./event-attendee-picker";
import { EventCoverField } from "./event-cover-field";
import { EventDateRangePicker } from "./event-date-range-picker";
import { EVENT_CONTROL_CLASS } from "./event-form-controls";
import { EventMarkdownEditor } from "./event-markdown-editor";

export type EventFormValues = {
  readonly title: string;
  readonly description: string;
  readonly occursAt: string;
  readonly endsAt: string | null;
  readonly imageUrl: string;
  readonly publicity: EventPublicity;
  readonly guestPermission: EventGuestPermission;
  readonly location: EventLocationValue;
  readonly counterpartyIds: readonly string[];
};

export type EventFormDialogProps = {
  readonly open: boolean;
  readonly mode: "create" | "edit";
  readonly initialValues: EventFormValues;
  readonly saving: boolean;
  /** Known while editing; lets edit-guests upload a cover for this event. */
  readonly eventId?: string | null;
  /** Publicity and guest rights belong to the owner only. */
  readonly canManageSharing?: boolean;
  /** Date/time and address belong to the owner only. */
  readonly canManageScheduleAndLocation?: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (values: EventFormValues) => Promise<void>;
};

export function emptyEventFormValues(): EventFormValues {
  return {
    title: "",
    description: "",
    occursAt: new Date().toISOString(),
    endsAt: null,
    imageUrl: "",
    publicity: EventPublicity.Private,
    guestPermission: EventGuestPermission.View,
    location: { address: "", latitude: null, longitude: null },
    counterpartyIds: [],
  };
}

/** Fills optional fields so partial/stale form payloads never crash the editor. */
function normalizeEventFormValues(values: EventFormValues): EventFormValues {
  return {
    ...values,
    title: values.title ?? "",
    description: values.description ?? "",
    imageUrl: values.imageUrl ?? "",
    counterpartyIds: values.counterpartyIds ?? [],
    location: values.location ?? {
      address: "",
      latitude: null,
      longitude: null,
    },
  };
}

export function EventFormDialog({
  open,
  mode,
  initialValues,
  saving,
  eventId = null,
  canManageSharing = true,
  canManageScheduleAndLocation = true,
  onOpenChange,
  onSubmit,
}: EventFormDialogProps) {
  const t = useTranslations("events");
  const tCommon = useTranslations("common");
  const publicityItems = useMemo(
    () => [
      { value: EventPublicity.Private, label: t("publicityPrivate") },
      { value: EventPublicity.Public, label: t("publicityPublic") },
    ],
    [t],
  );
  const permissionItems = useMemo(
    () => [
      { value: EventGuestPermission.View, label: t("permissionView") },
      { value: EventGuestPermission.Edit, label: t("permissionEdit") },
    ],
    [t],
  );
  const [values, setValues] = useState<EventFormValues>(() =>
    normalizeEventFormValues(initialValues),
  );
  const [loadedValues, setLoadedValues] = useState<EventFormValues>(initialValues);

  if (open && loadedValues !== initialValues) {
    const next = normalizeEventFormValues(initialValues);
    setLoadedValues(initialValues);
    setValues(next);
  }

  async function submit() {
    if (!values.title.trim()) {
      toast.error(t("titleRequired"));
      return;
    }
    await onSubmit(normalizeEventFormValues(values));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) {
          onOpenChange(next);
        }
      }}
    >
      <ResponsiveDialogContent size="xl" showCloseButton>
        <ResponsiveDialogHeader>
          <ResponsiveDialogHeaderInner>
            <DialogTitle className="text-xl font-semibold tracking-tight">
              {mode === "create" ? t("createTitle") : t("editTitle")}
            </DialogTitle>
          </ResponsiveDialogHeaderInner>
          <div className="pb-3" />
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody className="space-y-5">
          <div className="space-y-2">
            <Label>{t("title")}</Label>
            <Input
              className={EVENT_CONTROL_CLASS}
              value={values.title}
              autoFocus
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>{t("description")}</Label>
            <EventMarkdownEditor
              value={values.description}
              placeholder={t("descriptionPlaceholder")}
              onChange={(description) =>
                setValues((current) => ({ ...current, description }))
              }
            />
          </div>

          {canManageScheduleAndLocation ? (
            <div className="space-y-2">
              <Label>{t("date")}</Label>
              <EventDateRangePicker
                value={{ occursAt: values.occursAt, endsAt: values.endsAt }}
                onChange={(schedule) =>
                  setValues((current) => ({ ...current, ...schedule }))
                }
              />
            </div>
          ) : null}

          <EventCoverField
            value={values.imageUrl}
            eventId={eventId}
            onChange={(imageUrl) =>
              setValues((current) => ({ ...current, imageUrl }))
            }
          />

          {mode === "create" ? (
            <EventAttendeePicker
              selectedIds={values.counterpartyIds}
              onChange={(counterpartyIds) =>
                setValues((current) => ({ ...current, counterpartyIds }))
              }
            />
          ) : null}

          <div
            className={cn(
              "grid gap-4 sm:grid-cols-2",
              !canManageSharing && "hidden",
            )}
          >
            <div className="space-y-2">
              <Label>{t("publicity")}</Label>
              <Select
                value={values.publicity}
                items={publicityItems}
                onValueChange={(next) =>
                  setValues((current) => ({
                    ...current,
                    publicity: next as EventPublicity,
                  }))
                }
              >
                <SelectTrigger className={EVENT_CONTROL_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {publicityItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("guestPermission")}</Label>
              <Select
                value={values.guestPermission}
                items={permissionItems}
                onValueChange={(next) =>
                  setValues((current) => ({
                    ...current,
                    guestPermission: next as EventGuestPermission,
                  }))
                }
              >
                <SelectTrigger className={EVENT_CONTROL_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {permissionItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {canManageScheduleAndLocation ? (
            <EventAddressPicker
              mapActive={open}
              value={values.location}
              onChange={(location) =>
                setValues((current) => ({ ...current, location }))
              }
            />
          ) : null}
        </ResponsiveDialogBody>

        <ResponsiveDialogFooter>
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full rounded-xl text-base sm:w-auto md:h-10"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            className="h-12 w-full rounded-xl text-base sm:w-auto md:h-10"
            disabled={saving || !values.title.trim()}
            onClick={() => void submit()}
          >
            {saving ? <Loader2 className="animate-spin" /> : null}
            {tCommon("save")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
