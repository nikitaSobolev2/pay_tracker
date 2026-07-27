"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { applyCsvImport, previewCsvImport } from "@/lib/api/settings";
import type { CsvPreviewResult } from "@/server/services/csv-import-export-service.types";

type CsvImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
};

export function CsvImportDialog({
  open,
  onOpenChange,
  onImported,
}: CsvImportDialogProps) {
  const tCommon = useTranslations("common");
  const [preview, setPreview] = useState<CsvPreviewResult | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  async function handleFile(file: File | null) {
    if (!file) {
      return;
    }
    setLoading(true);
    try {
      const text = await file.text();
      setCsvText(text);
      const result = await previewCsvImport(file);
      setPreview(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    if (!csvText) {
      return;
    }
    setApplying(true);
    try {
      const result = await applyCsvImport({ csvText });
      const catalogHint =
        result.categoriesImported || result.counterpartiesImported
          ? ` · categories ${result.categoriesImported}, counterparties ${result.counterpartiesImported}`
          : "";
      toast.success(
        `Imported ${result.importedCount}, skipped ${result.skippedCount}${catalogHint}`,
      );
      onOpenChange(false);
      setPreview(null);
      setCsvText(null);
      onImported?.();
      window.dispatchEvent(new CustomEvent("paytracker:transactions-changed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
    } finally {
      setApplying(false);
    }
  }

  const canApply =
    Boolean(csvText) &&
    Boolean(preview) &&
    (preview!.validCount > 0 ||
      preview!.catalog.categories > 0 ||
      preview!.catalog.counterparties > 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setPreview(null);
          setCsvText(null);
        }
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{tCommon("import")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) =>
              void handleFile(event.target.files?.[0] ?? null)
            }
          />
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin" />
            </div>
          ) : null}
          {preview ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge>valid: {preview.validCount}</Badge>
                <Badge variant="secondary">
                  invalid: {preview.invalidCount}
                </Badge>
                <Badge variant="outline">
                  duplicate: {preview.duplicateCount}
                </Badge>
                <Badge variant="outline">
                  categories: {preview.catalog.categories}
                </Badge>
                <Badge variant="outline">
                  counterparties: {preview.catalog.counterparties}
                </Badge>
                <Badge variant="outline">
                  links: {preview.catalog.links}
                </Badge>
              </div>
              <div className="max-h-80 overflow-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Kind</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Errors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.map((row) => (
                      <TableRow key={row.index}>
                        <TableCell>{row.index + 1}</TableCell>
                        <TableCell>{row.status}</TableCell>
                        <TableCell>{row.row?.type ?? "—"}</TableCell>
                        <TableCell>{row.row?.kind ?? "—"}</TableCell>
                        <TableCell>
                          {row.row
                            ? `${row.row.originalAmount} ${row.row.inputCurrency}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.errors.join("; ") || row.duplicateReason || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setPreview(null);
              setCsvText(null);
              onOpenChange(false);
            }}
          >
            {tCommon("deny")}
          </Button>
          <Button
            disabled={!canApply || applying}
            onClick={() => void handleApply()}
          >
            {applying ? <Loader2 className="animate-spin" /> : null}
            {tCommon("apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
