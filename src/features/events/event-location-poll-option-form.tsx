"use client";

import { Loader2, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
import type { PollOptionBody } from "@/lib/api/events";
import { fetchLinkPreview } from "@/lib/api/link-preview";

import { EVENT_CONTROL_CLASS } from "./event-form-controls";
import {
  EventAddressPicker,
  type EventLocationValue,
} from "./event-address-picker";

export type PollOptionDraft = {
  readonly key: string;
  optionId: string | null;
  title: string;
  link: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
};

export function emptyPollOptionDraft(): PollOptionDraft {
  return {
    key: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    optionId: null,
    title: "",
    link: "",
    address: "",
    latitude: null,
    longitude: null,
    imageUrl: null,
  };
}

export function pollOptionToDraft(option: {
  readonly id: string;
  readonly title: string;
  readonly link: string | null;
  readonly address: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly imageUrl: string | null;
}): PollOptionDraft {
  return {
    key: option.id,
    optionId: option.id,
    title: option.title,
    link: option.link ?? "",
    address: option.address ?? "",
    latitude: option.latitude,
    longitude: option.longitude,
    imageUrl: option.imageUrl,
  };
}

const FOOTER_BUTTON_CLASS =
  "h-12 w-full rounded-xl text-base sm:w-auto md:h-10";

export function EventLocationPollOptionFields({
  value,
  onChange,
}: {
  readonly value: PollOptionDraft;
  readonly onChange: (next: Partial<PollOptionDraft>) => void;
}) {
  const t = useTranslations("events");
  const [addressOpen, setAddressOpen] = useState(false);

  useEffect(() => {
    const link = value.link.trim();
    if (!link.startsWith("http")) {
      return;
    }
    const timer = window.setTimeout(() => {
      void fetchLinkPreview(link)
        .then((result) => onChange({ imageUrl: result.imageUrl }))
        .catch(() => onChange({ imageUrl: null }));
    }, 500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-preview when link changes
  }, [value.link]);

  return (
    <>
      <div className="min-w-0 space-y-4 overflow-hidden">
        <div className="space-y-2">
          <Label>{t("pollOptionTitle")}</Label>
          <Input
            value={value.title}
            placeholder={t("pollOptionTitle")}
            className={EVENT_CONTROL_CLASS}
            onChange={(event) => onChange({ title: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("pollOptionLink")}</Label>
          <Input
            value={value.link}
            placeholder={t("pollOptionLink")}
            className={EVENT_CONTROL_CLASS}
            onChange={(event) => onChange({ link: event.target.value })}
          />
        </div>
        {value.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value.imageUrl}
            alt=""
            className="h-28 w-full max-w-full rounded-xl object-cover"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : null}
        <div className="space-y-2">
          <Label>{t("pollOptionAddress")}</Label>
          <Button
            type="button"
            variant="outline"
            className={`${EVENT_CONTROL_CLASS} h-auto min-h-12 justify-start gap-2 overflow-hidden py-2.5`}
            onClick={() => setAddressOpen(true)}
          >
            <MapPin className="size-4 shrink-0" />
            <span className="min-w-0 truncate text-left">
              {value.address || t("pollOptionAddress")}
            </span>
          </Button>
        </div>
      </div>

      {typeof document !== "undefined"
        ? createPortal(
            <Dialog open={addressOpen} onOpenChange={setAddressOpen}>
              <ResponsiveDialogContent
                size="map"
                showCloseButton
                container={document.body}
                overlayClassName="ui-dialog-overlay--nested"
                style={{ zIndex: 1400 }}
                overlayStyle={{ zIndex: 1400 }}
              >
                <ResponsiveDialogHeader>
                  <ResponsiveDialogHeaderInner>
                    <DialogTitle className="text-xl font-semibold tracking-tight">
                      {t("pollOptionAddress")}
                    </DialogTitle>
                  </ResponsiveDialogHeaderInner>
                  <div className="pb-3" />
                </ResponsiveDialogHeader>
                <ResponsiveDialogBody className="space-y-4">
                  <EventAddressPicker
                    mapActive={addressOpen}
                    mapClassName="event-address-picker-map--lg min-h-64 sm:min-h-[min(58svh,36rem)]"
                    value={{
                      address: value.address,
                      latitude: value.latitude,
                      longitude: value.longitude,
                    }}
                    onChange={(location: EventLocationValue) =>
                      onChange({
                        address: location.address,
                        latitude: location.latitude,
                        longitude: location.longitude,
                      })
                    }
                  />
                </ResponsiveDialogBody>
                <ResponsiveDialogFooter>
                  <Button
                    type="button"
                    className={FOOTER_BUTTON_CLASS}
                    onClick={() => setAddressOpen(false)}
                  >
                    {t("pollAddressDone")}
                  </Button>
                </ResponsiveDialogFooter>
              </ResponsiveDialogContent>
            </Dialog>,
            document.body,
          )
        : null}
    </>
  );
}

export function EventLocationPollOptionFormDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (option: PollOptionBody) => Promise<void>;
}) {
  const t = useTranslations("events");
  const tCommon = useTranslations("common");
  const [draft, setDraft] = useState<PollOptionDraft>(emptyPollOptionDraft);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(emptyPollOptionDraft());
    }
  }, [open]);

  async function submit() {
    const title = draft.title.trim();
    if (!title) {
      toast.error(t("pollCreateInvalid"));
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        title,
        link: draft.link.trim() || null,
        address: draft.address.trim() || null,
        latitude: draft.latitude,
        longitude: draft.longitude,
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("pollOptionFailed"),
      );
    } finally {
      setSaving(false);
    }
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
      <ResponsiveDialogContent size="md" showCloseButton>
        <ResponsiveDialogHeader>
          <ResponsiveDialogHeaderInner>
            <DialogTitle className="text-xl font-semibold tracking-tight">
              {t("pollAddOption")}
            </DialogTitle>
          </ResponsiveDialogHeaderInner>
          <div className="pb-3" />
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody className="space-y-4">
          <EventLocationPollOptionFields
            value={draft}
            onChange={(patch) =>
              setDraft((current) => ({ ...current, ...patch }))
            }
          />
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <Button
            type="button"
            variant="outline"
            className={FOOTER_BUTTON_CLASS}
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            className={FOOTER_BUTTON_CLASS}
            disabled={saving}
            onClick={() => void submit()}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {tCommon("save")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
