import { apiFetch } from "@/lib/api/client";
import type {
  CsvApplyResult,
  CsvImportRow,
  CsvPreviewResult,
} from "@/server/services/csv-import-export-service.types";
import type { AppUser } from "@/types/auth";
import type { AppLocale, AppTheme } from "@/types/enums";

export type PreferencesInput = Partial<{
  locale: AppLocale;
  timezone: string;
  theme: AppTheme;
  defaultCurrency: string;
}>;

export function fetchMe() {
  return apiFetch<{ user: AppUser }>("/api/auth/me");
}

export function updatePreferences(input: PreferencesInput) {
  return apiFetch<{ user: AppUser }>("/api/settings/preferences", {
    method: "PATCH",
    body: input,
  });
}

export function deleteAccount() {
  return apiFetch<{ ok: true }>("/api/settings/account", {
    method: "DELETE",
  });
}

export function previewCsvImport(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<CsvPreviewResult>("/api/import-export/preview", {
    method: "POST",
    formData,
  });
}

export function applyCsvImport(rows: CsvImportRow[]) {
  return apiFetch<CsvApplyResult>("/api/import-export/apply", {
    method: "POST",
    body: { rows },
  });
}

export async function exportCsv(): Promise<Blob> {
  const response = await fetch("/api/import-export/export", {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Export failed");
  }
  return response.blob();
}
