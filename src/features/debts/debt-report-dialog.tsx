"use client";

import { Check, Copy, Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import {
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogHeaderInner,
} from "@/components/ui/responsive-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  copyPngBlob,
  downloadPngBlob,
  renderDebtReportPng,
} from "@/lib/debt-report-image";
import {
  debtReportRowsFromStats,
  formatDebtReportHistory,
  formatDebtReportText,
  formatDebtReportTotal,
  selectedDebtReportRows,
  type DebtReportRow,
} from "@/lib/debt-report-text";
import { cn } from "@/lib/utils";
import type { DebtsStats } from "@/server/services/stats-service.types";

type DebtReportDialogProps = {
  readonly stats: DebtsStats;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

export function DebtReportDialog({
  stats,
  open,
  onOpenChange,
}: DebtReportDialogProps) {
  const t = useTranslations("debts");
  const tCommon = useTranslations("common");
  const rows = useMemo(() => debtReportRowsFromStats(stats), [stats]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(rows.map((row) => row.id)),
  );
  const [asImage, setAsImage] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const selectedRows = selectedDebtReportRows(rows, selectedIds);
  const reportText = formatDebtReportText(selectedRows);
  const canExport = selectedRows.length > 0;

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelectedIds(new Set(rows.map((row) => row.id)));
    setAsImage(false);
    setCopied(false);
  }, [open, rows]);

  function togglePerson(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function copyReport() {
    if (!canExport) {
      return;
    }
    setBusy(true);
    try {
      if (asImage) {
        await copyPngBlob(await renderDebtReportPng(selectedRows));
      } else {
        await navigator.clipboard.writeText(reportText);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error(t("reportCopyFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function downloadReport() {
    if (!canExport) {
      return;
    }
    setBusy(true);
    try {
      downloadPngBlob(await renderDebtReportPng(selectedRows), "debt-report.png");
    } catch {
      toast.error(t("reportDownloadFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent size="md" showCloseButton>
        <ResponsiveDialogHeader>
          <ResponsiveDialogHeaderInner>
            <DialogTitle className="text-xl font-semibold tracking-tight">
              {t("report")}
            </DialogTitle>
          </ResponsiveDialogHeaderInner>
          <div className="px-4 pt-3 pb-3 sm:px-5">
            <ReportTypeSwitch
              asImage={asImage}
              textLabel={t("reportText")}
              imageLabel={t("reportImage")}
              onAsImageChange={setAsImage}
            />
          </div>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody className="space-y-5">
          <FormField label={t("reportPeople")}>
            <ReportPeopleChips
              rows={rows}
              selectedIds={selectedIds}
              clearLabel={tCommon("clearAll")}
              onToggle={togglePerson}
              onClear={() => setSelectedIds(new Set())}
            />
          </FormField>

          <ReportPreview
            asImage={asImage}
            rows={selectedRows}
            text={reportText}
            emptyLabel={t("reportEmpty")}
          />
        </ResponsiveDialogBody>

        <ResponsiveDialogFooter>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            {tCommon("cancel")}
          </Button>
          {asImage ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              disabled={!canExport || busy}
              onClick={() => void downloadReport()}
            >
              <Download className="size-4" />
              {t("reportDownload")}
            </Button>
          ) : null}
          <Button
            type="button"
            className="h-11 rounded-xl"
            disabled={!canExport || busy}
            onClick={() => void copyReport()}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? t("reportCopied") : t("reportCopy")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}

function ReportPeopleChips({
  rows,
  selectedIds,
  clearLabel,
  onToggle,
  onClear,
}: {
  readonly rows: readonly DebtReportRow[];
  readonly selectedIds: ReadonlySet<string>;
  readonly clearLabel: string;
  readonly onToggle: (id: string) => void;
  readonly onClear: () => void;
}) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {rows.map((row) => {
        const active = selectedIds.has(row.id);
        return (
          <button
            key={row.id}
            type="button"
            className="cursor-pointer"
            onClick={() => onToggle(row.id)}
          >
            <Badge
              variant={active ? "default" : "outline"}
              className={cn(
                "h-10 rounded-full px-3.5 text-sm font-medium",
                active && "bg-foreground text-background",
              )}
            >
              {row.name}
            </Badge>
          </button>
        );
      })}
      <Button
        type="button"
        variant="ghost"
        className="h-10 rounded-full px-3.5 text-sm"
        disabled={selectedIds.size === 0}
        onClick={onClear}
      >
        {clearLabel}
      </Button>
    </div>
  );
}

function ReportTypeSwitch({
  asImage,
  textLabel,
  imageLabel,
  onAsImageChange,
}: {
  readonly asImage: boolean;
  readonly textLabel: string;
  readonly imageLabel: string;
  readonly onAsImageChange: (asImage: boolean) => void;
}) {
  return (
    <Tabs
      className="w-full"
      value={asImage ? "image" : "text"}
      onValueChange={(value) => {
        if (value === "text" || value === "image") {
          onAsImageChange(value === "image");
        }
      }}
    >
      <TabsList className="grid h-14 w-full grid-cols-2 rounded-xl p-1.5 md:h-14 md:w-full md:rounded-xl md:p-1.5">
        <TabsTrigger
          value="text"
          className="h-full rounded-lg px-4 text-base font-medium md:rounded-lg md:px-4 md:py-2 md:text-base"
        >
          {textLabel}
        </TabsTrigger>
        <TabsTrigger
          value="image"
          className="h-full rounded-lg px-4 text-base font-medium md:rounded-lg md:px-4 md:py-2 md:text-base"
        >
          {imageLabel}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

function ReportPreview({
  asImage,
  rows,
  text,
  emptyLabel,
}: {
  readonly asImage: boolean;
  readonly rows: readonly DebtReportRow[];
  readonly text: string;
  readonly emptyLabel: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  if (asImage) {
    return <ReportImagePreview rows={rows} />;
  }
  return (
    <Textarea
      readOnly
      value={text}
      className="min-h-40 resize-none whitespace-pre font-mono text-sm"
    />
  );
}

function ReportImagePreview({
  rows,
}: {
  readonly rows: readonly DebtReportRow[];
}) {
  return (
    <div className="grid gap-2">
      {rows.map((row) => {
        const history = formatDebtReportHistory(row);
        return (
          <div
            key={row.id}
            className="rounded-2xl border border-border/70 bg-card px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-semibold tracking-tight">
                {row.name}
              </p>
              <p
                className={cn(
                  "shrink-0 text-base font-semibold tabular-nums",
                  row.tone === "owe" ? "text-rose-400" : "text-emerald-400",
                )}
              >
                {formatDebtReportTotal(row)}
              </p>
            </div>
            {history ? (
              <p className="mt-1.5 text-xs leading-relaxed wrap-break-word text-muted-foreground">
                {history}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
