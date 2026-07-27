"use client";

import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";

import { PageTitleWithBack } from "@/components/layout/page-back-button";
import { LocaleSelect } from "@/components/locale-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDeleteAccountDialog } from "@/features/settings/confirm-delete-account-dialog";
import { ClearTransactionsDialog } from "@/features/settings/clear-transactions-dialog";
import { CsvImportDialog } from "@/features/settings/csv-import-dialog";
import { TimezoneCombobox } from "@/features/settings/timezone-combobox";
import { useAppUser } from "@/hooks/use-app-user";
import { useRouter } from "@/i18n/navigation";
import {
  deleteAccount,
  exportCsv,
  updatePreferences,
} from "@/lib/api/settings";
import { authClient } from "@/lib/auth-client";
import { getClientCurrencies } from "@/lib/currencies";
import { cn } from "@/lib/utils";
import { AppLocale, AppTheme } from "@/types/enums";

export function SettingsPage() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { setTheme } = useTheme();
  const { user, loading: userLoading, refresh } = useAppUser();

  const [prefs, setPrefs] = useState<{
    locale: AppLocale;
    timezone: string;
    theme: AppTheme;
    defaultCurrency: string;
  }>({
    locale: AppLocale.En,
    timezone: "UTC",
    theme: AppTheme.System,
    defaultCurrency: "RUB",
  });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }
    setPrefs({
      locale: user.locale,
      timezone: user.timezone,
      theme: user.theme,
      defaultCurrency: user.defaultCurrency,
    });
  }, [user]);

  async function savePreferences() {
    setSavingPrefs(true);
    try {
      const updated = await updatePreferences({
        locale: prefs.locale,
        timezone: prefs.timezone,
        theme: prefs.theme,
        defaultCurrency: prefs.defaultCurrency,
      });
      setTheme(updated.user.theme);
      await refresh();
      toast.success(tCommon("save"));
      if (updated.user.locale !== locale) {
        router.replace("/settings", { locale: updated.user.locale });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSavingPrefs(false);
    }
  }

  async function changePassword() {
    if (!currentPassword || !newPassword) {
      return;
    }
    setSavingPassword(true);
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
      });
      if (result.error) {
        throw new Error(result.error.message ?? "Password change failed");
      }
      setCurrentPassword("");
      setNewPassword("");
      toast.success(t("changePassword"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Password failed");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleExport() {
    try {
      const blob = await exportCsv();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "paytracker-export.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await deleteAccount();
      await authClient.signOut();
      router.replace("/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
      setDeleting(false);
    }
  }

  if (userLoading && !user) {
    return <SettingsPageSkeleton title={t("title")} />;
  }

  return (
    <div className="mx-auto w-full max-w-2xl pb-10">
      <header className="mb-10">
        <PageTitleWithBack fallbackHref="/">
          <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            {user?.username}
            {user?.email ? (
              <span className="text-muted-foreground/80"> · {user.email}</span>
            ) : null}
          </p>
        </PageTitleWithBack>
      </header>

      <div className="space-y-0 divide-y divide-border/50">
        <SettingsZone title={t("preferences")}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t("locale")}>
              <LocaleSelect
                value={prefs.locale}
                triggerClassName={controlClassName}
                onValueChange={(value) => {
                  setPrefs((prev) => ({ ...prev, locale: value }));
                }}
              />
            </Field>

            <Field label={t("timezone")}>
              <TimezoneCombobox
                value={prefs.timezone}
                onChange={(timezone) =>
                  setPrefs((prev) => ({ ...prev, timezone }))
                }
              />
            </Field>

            <Field label={t("theme")}>
              <Select
                value={prefs.theme}
                items={THEME_ITEMS}
                onValueChange={(value) => {
                  if (
                    value === AppTheme.Light ||
                    value === AppTheme.Dark ||
                    value === AppTheme.System
                  ) {
                    setPrefs((prev) => ({ ...prev, theme: value }));
                  }
                }}
              >
                <SelectTrigger className={controlClassName}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THEME_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label={t("defaultCurrency")}>
              <Select
                value={prefs.defaultCurrency}
                items={CURRENCY_ITEMS}
                onValueChange={(value) => {
                  if (typeof value === "string") {
                    setPrefs((prev) => ({ ...prev, defaultCurrency: value }));
                  }
                }}
              >
                <SelectTrigger className={controlClassName}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Button
            className={cn(actionButtonClassName, "mt-6")}
            disabled={savingPrefs}
            onClick={() => void savePreferences()}
          >
            {savingPrefs ? <Loader2 className="animate-spin" /> : null}
            {tCommon("save")}
          </Button>
        </SettingsZone>

        <SettingsZone title={t("changePassword")}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t("currentPassword")}>
              <Input
                type="password"
                className={controlClassName}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </Field>
            <Field label={t("newPassword")}>
              <Input
                type="password"
                className={controlClassName}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </Field>
          </div>
          <Button
            className={cn(actionButtonClassName, "mt-6")}
            disabled={savingPassword}
            onClick={() => void changePassword()}
          >
            {savingPassword ? <Loader2 className="animate-spin" /> : null}
            {t("changePassword")}
          </Button>
        </SettingsZone>

        <SettingsZone title={t("data")}>
          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              className={actionButtonClassName}
              onClick={() => void handleExport()}
            >
              {tCommon("export")}
            </Button>
            <Button
              variant="outline"
              className={actionButtonClassName}
              onClick={() => setImportOpen(true)}
            >
              {tCommon("import")}
            </Button>
          </div>
        </SettingsZone>

        <SettingsZone title={t("danger")} danger>
          <p className="mb-5 max-w-md text-sm text-muted-foreground">
            {t("clearTransactionsDescription")}
          </p>
          <Button
            variant="destructive"
            className={cn(actionButtonClassName, "mb-4")}
            onClick={() => setClearOpen(true)}
          >
            {t("clearTransactions")}
          </Button>
          <p className="mb-5 max-w-md text-sm text-muted-foreground">
            {t("deleteAccountConfirm")}
          </p>
          <Button
            variant="destructive"
            className={actionButtonClassName}
            disabled={deleting}
            onClick={() => setDeleteOpen(true)}
          >
            {t("deleteAccount")}
          </Button>
        </SettingsZone>
      </div>

      <CsvImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <ClearTransactionsDialog open={clearOpen} onOpenChange={setClearOpen} />
      <ConfirmDeleteAccountDialog
        open={deleteOpen}
        loading={deleting}
        onOpenChange={setDeleteOpen}
        onConfirm={() => void handleDeleteAccount()}
      />
    </div>
  );
}

const controlClassName =
  "h-11 w-full rounded-xl text-base data-[size=default]:h-11 md:text-sm";

const actionButtonClassName =
  "h-14 w-full rounded-xl text-base font-medium md:h-12";

const THEME_ITEMS = [
  { value: AppTheme.Light, label: "Light" },
  { value: AppTheme.Dark, label: "Dark" },
  { value: AppTheme.System, label: "System" },
] as const;

const CURRENCY_ITEMS = getClientCurrencies().map((currency) => ({
  value: currency,
  label: currency,
}));

function SettingsZone({
  title,
  children,
  danger = false,
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly danger?: boolean;
}) {
  return (
    <section className="py-8 first:pt-2 last:pb-0">
      <h2
        className={cn(
          "mb-5 text-lg font-semibold tracking-tight",
          danger && "text-destructive",
        )}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SettingsPageSkeleton({ title }: { readonly title: string }) {
  return (
    <div className="mx-auto w-full max-w-2xl pb-10">
      <header className="mb-10">
        <PageTitleWithBack fallbackHref="/">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <Skeleton className="mt-2 h-5 w-48 max-w-full sm:h-6 sm:w-64" />
        </PageTitleWithBack>
      </header>

      <div className="space-y-0 divide-y divide-border/50">
        <section className="py-8 first:pt-2">
          <Skeleton className="mb-5 h-7 w-32" />
          <div className="grid gap-5 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={`pref-field-${index}`} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            ))}
          </div>
          <Skeleton className="mt-6 h-14 w-full rounded-xl md:h-12" />
        </section>

        <section className="py-8">
          <Skeleton className="mb-5 h-7 w-40" />
          <div className="grid gap-5 sm:grid-cols-2">
            {Array.from({ length: 2 }, (_, index) => (
              <div key={`pw-field-${index}`} className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            ))}
          </div>
          <Skeleton className="mt-6 h-14 w-full rounded-xl md:h-12" />
        </section>

        <section className="py-8">
          <Skeleton className="mb-5 h-7 w-16" />
          <div className="flex flex-col gap-3">
            <Skeleton className="h-14 w-full rounded-xl md:h-12" />
            <Skeleton className="h-14 w-full rounded-xl md:h-12" />
          </div>
        </section>

        <section className="py-8 last:pb-0">
          <Skeleton className="mb-5 h-7 w-28" />
          <Skeleton className="mb-5 h-4 w-full max-w-md" />
          <Skeleton className="h-14 w-full rounded-xl md:h-12" />
        </section>
      </div>
    </div>
  );
}
