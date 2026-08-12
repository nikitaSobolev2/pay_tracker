"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { PageTitleWithBack } from "@/components/layout/page-back-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmCounterpartyDeleteDialog } from "@/features/counterparties/confirm-counterparty-delete-dialog";
import { DebtDetailPage } from "@/features/debts/debt-detail-page";
import {
  deleteCounterparty,
  listCounterparties,
  updateCounterparty,
  type CounterpartyDto,
} from "@/lib/api/counterparties";
import { useRouter } from "@/i18n/navigation";

export function CounterpartyDetailPage({ id }: { readonly id: string }) {
  const t = useTranslations("counterparties");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [counterparty, setCounterparty] = useState<CounterpartyDto | null>(
    null,
  );
  const [draftName, setDraftName] = useState("");
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const { counterparties } = await listCounterparties({ all: true });
    const found = counterparties.find((item) => item.id === id) ?? null;
    setCounterparty(found);
    setDraftName(found?.name ?? "");
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!counterparty || !draftName.trim()) {
      return;
    }
    const result = await updateCounterparty(
      counterparty.id,
      draftName.trim(),
    );
    setCounterparty(result.counterparty);
    setEditing(false);
    toast.success(t("updated"));
  }

  async function remove() {
    if (!counterparty) {
      return;
    }
    setDeleting(true);
    try {
      await deleteCounterparty(counterparty.id);
      setDeleteOpen(false);
      toast.success(t("deleted"));
      router.replace("/counterparties");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("deleteFailed"),
      );
    } finally {
      setDeleting(false);
    }
  }

  if (!counterparty) {
    return null;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <PageTitleWithBack fallbackHref="/counterparties">
          {editing ? (
            <Input
              className="w-full max-w-sm"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
            />
          ) : (
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {counterparty.name}
            </h1>
          )}
        </PageTitleWithBack>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {editing ? (
            <Button
              className="h-11 w-full sm:h-9 sm:w-auto"
              onClick={() => void save()}
            >
              {tCommon("save")}
            </Button>
          ) : (
            <Button
              variant="outline"
              className="h-11 w-full sm:h-9 sm:w-auto"
              onClick={() => setEditing(true)}
            >
              <Pencil /> {tCommon("edit")}
            </Button>
          )}
          <Button
            variant="destructive"
            className="h-11 w-full sm:h-9 sm:w-auto"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 /> {tCommon("delete")}
          </Button>
        </div>
      </header>
      <DebtDetailPage counterpartyId={id} embedded />
      <ConfirmCounterpartyDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        name={counterparty.name}
        loading={deleting}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
