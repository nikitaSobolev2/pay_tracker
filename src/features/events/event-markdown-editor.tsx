"use client";

import {
  Bold,
  Heading2,
  Italic,
  Link2,
  List,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { renderMarkdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";

export type EventMarkdownEditorProps = {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly className?: string;
};

type EditorTab = "write" | "preview";

type WrapOptions = {
  readonly before: string;
  readonly after?: string;
  readonly placeholder?: string;
  readonly block?: boolean;
};

export function EventMarkdownEditor({
  value,
  onChange,
  placeholder,
  className,
}: EventMarkdownEditorProps) {
  const t = useTranslations("events");
  const locale = useLocale();
  const [tab, setTab] = useState<EditorTab>("write");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const text = value ?? "";
  const previewHtml = renderMarkdown(
    text.trim() || t("descriptionEmptyPreview"),
    { locale },
  );

  function applyWrap(options: WrapOptions) {
    const textarea = textareaRef.current;
    if (!textarea) {
      onChange(`${options.before}${options.placeholder ?? ""}${options.after ?? ""}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = text.slice(start, end);
    const filler = selected || options.placeholder || "";
    const after = options.after ?? "";
    const prefix =
      options.block && start > 0 && text[start - 1] !== "\n"
        ? `\n${options.before}`
        : options.before;
    const suffix = options.block ? `${after}\n` : after;
    const next = `${text.slice(0, start)}${prefix}${filler}${suffix}${text.slice(end)}`;
    const selectionStart = start + prefix.length;
    const selectionEnd = selectionStart + filler.length;
    onChange(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(selectionStart, selectionEnd);
    });
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-input bg-transparent dark:bg-input/30",
        className,
      )}
    >
      <Tabs
        value={tab}
        onValueChange={(next) => {
          if (next === "write" || next === "preview") {
            setTab(next);
          }
        }}
        className="gap-0"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-2 py-1.5">
          <TabsList className="h-9 w-auto rounded-lg p-0.5 md:h-8">
            <TabsTrigger value="write" className="rounded-md px-3 text-xs md:text-sm">
              {t("descriptionWrite")}
            </TabsTrigger>
            <TabsTrigger value="preview" className="rounded-md px-3 text-xs md:text-sm">
              {t("descriptionPreview")}
            </TabsTrigger>
          </TabsList>

          {tab === "write" ? (
            <div className="flex flex-wrap items-center gap-0.5">
              <ToolbarButton
                icon={Bold}
                label={t("descriptionBold")}
                onClick={() =>
                  applyWrap({ before: "**", after: "**", placeholder: "bold" })
                }
              />
              <ToolbarButton
                icon={Italic}
                label={t("descriptionItalic")}
                onClick={() =>
                  applyWrap({ before: "_", after: "_", placeholder: "italic" })
                }
              />
              <ToolbarButton
                icon={Heading2}
                label={t("descriptionHeading")}
                onClick={() =>
                  applyWrap({
                    before: "## ",
                    placeholder: "Heading",
                    block: true,
                  })
                }
              />
              <ToolbarButton
                icon={List}
                label={t("descriptionList")}
                onClick={() =>
                  applyWrap({
                    before: "- ",
                    placeholder: "item",
                    block: true,
                  })
                }
              />
              <ToolbarButton
                icon={Link2}
                label={t("descriptionLink")}
                onClick={() =>
                  applyWrap({
                    before: "[",
                    after: "](https://)",
                    placeholder: "link",
                  })
                }
              />
              <ToolbarButton
                icon={Wallet}
                label={t("descriptionPayment")}
                onClick={() =>
                  applyWrap({
                    before: "```payment\n",
                    after: "\n```",
                    placeholder: t("descriptionPaymentPlaceholder"),
                    block: true,
                  })
                }
              />
            </div>
          ) : null}
        </div>

        <TabsContent value="write" className="mt-0">
          <Textarea
            ref={textareaRef}
            value={text}
            placeholder={placeholder}
            className="min-h-40 rounded-none border-0 bg-transparent px-3 py-3 shadow-none focus-visible:ring-0 dark:bg-transparent"
            onChange={(event) => onChange(event.target.value)}
          />
        </TabsContent>

        <TabsContent value="preview" className="mt-0">
          <div
            className={cn(
              "min-h-40 px-3 py-3 text-sm leading-relaxed",
              "[&_a]:text-primary [&_code]:rounded [&_code]:bg-muted [&_code]:px-1",
              "[&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-semibold",
              "[&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold",
              "[&_h3]:mb-1.5 [&_h3]:text-base [&_h3]:font-semibold",
              "[&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
              !text.trim() && "text-muted-foreground",
            )}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8 rounded-lg"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <Icon className="size-4" />
    </Button>
  );
}
