"use client";

import { Kanban, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { PageTitleWithBack } from "@/components/layout/page-back-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  ObjectCard,
  ObjectCardBody,
  ObjectCardCopy,
  OBJECT_STACK_CLASS,
} from "@/components/ui/object-card";
import {
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogHeaderInner,
} from "@/components/ui/responsive-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { transactionListParamsFromBoardQuery } from "@/features/transaction-calculator/calculator-board-payload";
import type { CalculatorSession } from "@/features/transaction-calculator/calculator-session";
import { TransactionCalculatorDialog } from "@/features/transaction-calculator/transaction-calculator-dialog";
import { useReadableDateTime } from "@/hooks/use-readable-date-time";
import {
  deleteCalculatorBoard,
  getCalculatorBoard,
  listCalculatorBoards,
  updateCalculatorBoard,
  type CalculatorBoardDto,
  type CalculatorBoardListItem,
} from "@/lib/api/calculator-boards";

export function CalculatorBoardsPage() {
  const t = useTranslations("transactionBoards");
  const tCommon = useTranslations("common");
  const formatDate = useReadableDateTime();
  const [boards, setBoards] = useState<CalculatorBoardListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openBoard, setOpenBoard] = useState<CalculatorBoardDto | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<CalculatorBoardListItem | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await listCalculatorBoards();
      setBoards(result.boards);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("loadFailed"));
    }
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    void listCalculatorBoards()
      .then((result) => {
        if (!cancelled) {
          setBoards(result.boards);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : t("loadFailed"),
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function openBoardById(id: string) {
    try {
      const result = await getCalculatorBoard(id);
      setOpenBoard(result.board);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("loadFailed"));
    }
  }

  async function persistOpenBoard(session: CalculatorSession) {
    if (!openBoard) {
      return;
    }
    const result = await updateCalculatorBoard(openBoard.id, {
      session,
      query: openBoard.query,
      title: openBoard.title,
    });
    setOpenBoard(result.board);
    await refresh();
  }

  async function removeBoard(id: string) {
    try {
      await deleteCalculatorBoard(id);
      if (openBoard?.id === id) {
        setOpenBoard(null);
      }
      toast.success(t("deleted"));
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("deleteFailed"));
    }
  }

  function boardsContent() {
    if (loading) {
      return (
        <div className={OBJECT_STACK_CLASS}>
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
      );
    }
    if (boards.length === 0) {
      return (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      );
    }
    return (
      <ul className={OBJECT_STACK_CLASS}>
        {boards.map((board) => (
          <li key={board.id}>
            <BoardCard
              board={board}
              updatedLabel={formatDate(board.updatedAt)}
              deleteLabel={t("delete")}
              onOpen={() => void openBoardById(board.id)}
              onDelete={() => setDeleteTarget(board)}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-10">
      <PageTitleWithBack fallbackHref="/transactions">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </PageTitleWithBack>
      {boardsContent()}
      {openBoard ? (
        <TransactionCalculatorDialog
          key={openBoard.id}
          mode="board"
          open
          queryBase={transactionListParamsFromBoardQuery(openBoard.query)}
          periodLabel={openBoard.query.periodLabel || openBoard.title}
          initialSession={openBoard.session}
          onPersistBoard={persistOpenBoard}
          onOpenChange={(next) => {
            if (!next) {
              setOpenBoard(null);
            }
          }}
        />
      ) : null}
      <Dialog
        open={deleteTarget != null}
        onOpenChange={(next) => {
          if (!next) {
            setDeleteTarget(null);
          }
        }}
      >
        <ResponsiveDialogContent size="md" showCloseButton>
          <ResponsiveDialogHeader>
            <ResponsiveDialogHeaderInner>
              <DialogTitle>{tCommon("confirm")}</DialogTitle>
              <DialogDescription>{t("deleteConfirm")}</DialogDescription>
            </ResponsiveDialogHeaderInner>
          </ResponsiveDialogHeader>
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              onClick={() => setDeleteTarget(null)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11 rounded-xl"
              onClick={() => {
                if (deleteTarget) {
                  void removeBoard(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
            >
              {tCommon("delete")}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </Dialog>
    </div>
  );
}

function BoardCard({
  board,
  updatedLabel,
  deleteLabel,
  onOpen,
  onDelete,
}: {
  readonly board: CalculatorBoardListItem;
  readonly updatedLabel: string;
  readonly deleteLabel: string;
  readonly onOpen: () => void;
  readonly onDelete: () => void;
}) {
  return (
    <ObjectCard>
      <button
        type="button"
        className="flex min-w-0 flex-1 text-left"
        onClick={onOpen}
      >
        <ObjectCardBody>
          <Kanban className="size-5 shrink-0 text-muted-foreground" />
          <ObjectCardCopy title={board.title} meta={updatedLabel} />
        </ObjectCardBody>
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="m-2 shrink-0"
        aria-label={deleteLabel}
        onClick={onDelete}
      >
        <Trash2 />
      </Button>
    </ObjectCard>
  );
}
