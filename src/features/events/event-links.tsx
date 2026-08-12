"use client";

import { ExternalLink, Link2, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import {
  BookmarkRail,
  ObjectCard,
  ObjectCardBody,
  ObjectCardCopy,
  OBJECT_STACK_CLASS,
} from "@/components/ui/object-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createEventLink, deleteEventLink } from "@/lib/api/events";
import type { EventLinkDto } from "@/server/services/event-service.types";
import { EventLinkType } from "@/types/enums";

import { useEventContext } from "./event-context";

export function EventLocationLinks({
  links,
}: {
  readonly links: readonly EventLinkDto[];
}) {
  if (links.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <a
          key={link.id}
          href={link.url}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs font-medium hover:bg-muted/50"
        >
          <ExternalLink className="size-3.5" />
          {link.title}
        </a>
      ))}
    </div>
  );
}

export function EventLinksButton({
  links,
}: {
  readonly links: readonly EventLinkDto[];
}) {
  const t = useTranslations("events");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-9 gap-1.5 rounded-xl"
        onClick={() => setOpen(true)}
      >
        <Link2 className="size-4" />
        {t("links")}
        {links.length > 0 ? (
          <span className="tabular-nums text-muted-foreground">
            {links.length}
          </span>
        ) : null}
      </Button>
      <EventLinksSheet open={open} onOpenChange={setOpen} />
    </>
  );
}

function EventLinksSheet({
  open,
  onOpenChange,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("events");
  const { event, viewer, refreshEvent } = useEventContext();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("links")}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-6">
          <EventLinkList
            links={event.links}
            canEdit={viewer.canEdit}
            onDeleted={refreshEvent}
          />
          {viewer.canEdit ? <EventLinkComposer onCreated={refreshEvent} /> : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EventLinkList({
  links,
  canEdit,
  onDeleted,
}: {
  readonly links: readonly EventLinkDto[];
  readonly canEdit: boolean;
  readonly onDeleted: () => Promise<void>;
}) {
  const t = useTranslations("events");
  const { event } = useEventContext();

  if (links.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("linksEmpty")}</p>;
  }

  async function remove(linkId: string) {
    try {
      await deleteEventLink(event.id, linkId);
      await onDeleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("linkFailed"));
    }
  }

  return (
    <ul className={OBJECT_STACK_CLASS}>
      {links.map((link) => {
        const typeLabel =
          link.type === EventLinkType.Location
            ? t("linkTypeLocation")
            : t("linkTypeOther");

        return (
          <li key={link.id}>
            <ObjectCard>
              <BookmarkRail />
              <ObjectCardBody>
                <ObjectCardCopy
                  title={
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex max-w-full items-center gap-1.5 underline-offset-4 hover:underline"
                    >
                      <span className="truncate">{link.title}</span>
                      <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                    </a>
                  }
                  meta={
                    <>
                      <p className="truncate">{link.url}</p>
                      <p>{typeLabel}</p>
                    </>
                  }
                />
                {canEdit ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 shrink-0 rounded-xl text-muted-foreground hover:text-destructive"
                    aria-label={t("linkDelete")}
                    onClick={() => void remove(link.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </ObjectCardBody>
            </ObjectCard>
          </li>
        );
      })}
    </ul>
  );
}

function EventLinkComposer({
  onCreated,
}: {
  readonly onCreated: () => Promise<void>;
}) {
  const t = useTranslations("events");
  const tCommon = useTranslations("common");
  const { event } = useEventContext();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<EventLinkType>(EventLinkType.Other);
  const [saving, setSaving] = useState(false);

  const typeItems = useMemo(
    () => [
      { value: EventLinkType.Location, label: t("linkTypeLocation") },
      { value: EventLinkType.Other, label: t("linkTypeOther") },
    ],
    [t],
  );

  function reset() {
    setTitle("");
    setUrl("");
    setType(EventLinkType.Other);
  }

  function closeComposer() {
    reset();
    setOpen(false);
  }

  async function submit() {
    setSaving(true);
    try {
      await createEventLink(event.id, {
        type,
        title: title.trim(),
        url: url.trim(),
      });
      await onCreated();
      closeComposer();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("linkFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full gap-1.5 rounded-xl"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" />
        {t("linkAdd")}
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
      <FormField label={t("linkTitle")} required>
        <Input
          className="h-11 rounded-xl"
          value={title}
          autoFocus
          required
          onChange={(changeEvent) => setTitle(changeEvent.target.value)}
        />
      </FormField>
      <FormField label={t("linkUrl")} required>
        <Input
          className="h-11 rounded-xl"
          placeholder="https://"
          value={url}
          required
          onChange={(changeEvent) => setUrl(changeEvent.target.value)}
        />
      </FormField>
      <FormField label={t("linkType")} required>
        <Select
          value={type}
          items={typeItems}
          onValueChange={(next) => {
            if (next != null) {
              setType(next as EventLinkType);
            }
          }}
        >
          <SelectTrigger className="h-11 w-full rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {typeItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 flex-1 rounded-xl"
          disabled={saving}
          onClick={closeComposer}
        >
          {tCommon("cancel")}
        </Button>
        <Button
          type="button"
          className="h-11 flex-1 gap-1.5 rounded-xl"
          disabled={saving || !title.trim() || !url.trim()}
          onClick={() => void submit()}
        >
          <Plus className="size-4" />
          {t("linkAdd")}
        </Button>
      </div>
    </div>
  );
}
