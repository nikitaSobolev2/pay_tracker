"use client";

import { Loader2, Pencil, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  deleteCounterparty,
  listCounterparties,
  updateCounterparty,
  type CounterpartyDto,
} from "@/lib/api/counterparties";
import { usePathname, useRouter } from "@/i18n/navigation";

import { ConfirmCounterpartyDeleteDialog } from "./confirm-counterparty-delete-dialog";

export function CounterpartiesPage() {
  const t = useTranslations("counterparties");
  const tCommon = useTranslations("common");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filterId = searchParams.get("id");
  const [counterparties, setCounterparties] = useState<CounterpartyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CounterpartyDto | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listCounterparties({ all: true });
      setCounterparties(result.counterparties);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const editingCounterparty =
    counterparties.find((item) => item.id === editingId) ?? null;

  const visibleCounterparties = useMemo(() => {
    if (!filterId) {
      return counterparties;
    }
    return counterparties.filter((item) => item.id === filterId);
  }, [counterparties, filterId]);

  function startEdit(counterparty: CounterpartyDto) {
    setEditingId(counterparty.id);
    setDraftName(counterparty.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraftName("");
  }

  async function saveEdit() {
    if (!editingCounterparty) {
      return;
    }
    const name = draftName.trim();
    if (!name) {
      toast.error(t("nameRequired"));
      return;
    }
    setSavingId(editingCounterparty.id);
    try {
      const result = await updateCounterparty(editingCounterparty.id, name);
      setCounterparties((current) =>
        current.map((item) =>
          item.id === editingCounterparty.id ? result.counterparty : item,
        ),
      );
      cancelEdit();
      toast.success(t("updated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("updateFailed"));
    } finally {
      setSavingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }
    setDeleting(true);
    try {
      await deleteCounterparty(deleteTarget.id);
      setCounterparties((current) =>
        current.filter((item) => item.id !== deleteTarget.id),
      );
      if (editingId === deleteTarget.id) {
        cancelEdit();
      }
      setDeleteTarget(null);
      toast.success(t("deleted"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("deleteFailed"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 pb-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          {t("subtitle")}
        </p>
      </header>

      {filterId ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">{t("showingFiltered")}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 rounded-lg"
            onClick={() => router.replace(pathname)}
          >
            <X className="size-3.5" />
            {t("showAll")}
          </Button>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
        <CounterpartiesListContent
          loading={loading}
          counterparties={visibleCounterparties}
          emptyLabel={t("empty")}
          onStartEdit={startEdit}
          onDelete={setDeleteTarget}
        />
      </section>

      <Dialog
        open={Boolean(editingCounterparty)}
        onOpenChange={(open) => {
          if (!open && !savingId) {
            cancelEdit();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("editCounterparty")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label>{t("nameField")}</Label>
            <Input
              className="h-11 rounded-xl text-base"
              value={draftName}
              autoFocus
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void saveEdit();
                }
              }}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              disabled={Boolean(savingId)}
              onClick={cancelEdit}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              className="h-11 rounded-xl"
              disabled={Boolean(savingId) || !draftName.trim()}
              onClick={() => void saveEdit()}
            >
              {savingId ? <Loader2 className="animate-spin" /> : null}
              {tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmCounterpartyDeleteDialog
        open={Boolean(deleteTarget)}
        name={deleteTarget?.name ?? ""}
        loading={deleting}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

function CounterpartiesListContent({
  loading,
  counterparties,
  emptyLabel,
  onStartEdit,
  onDelete,
}: {
  readonly loading: boolean;
  readonly counterparties: CounterpartyDto[];
  readonly emptyLabel: string;
  readonly onStartEdit: (counterparty: CounterpartyDto) => void;
  readonly onDelete: (counterparty: CounterpartyDto) => void;
}) {
  const tCommon = useTranslations("common");

  if (loading) {
    return (
      <div className="space-y-0 divide-y divide-border/50">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center justify-between gap-3 px-4 py-3.5"
          >
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-9 w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (counterparties.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border/50">
      {counterparties.map((counterparty) => (
        <li
          key={counterparty.id}
          className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="min-w-0 flex-1 truncate text-base font-medium">
            {counterparty.name}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-10 rounded-xl"
              aria-label={tCommon("edit")}
              onClick={() => onStartEdit(counterparty)}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-10 rounded-xl text-destructive hover:text-destructive"
              aria-label={tCommon("delete")}
              onClick={() => onDelete(counterparty)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
