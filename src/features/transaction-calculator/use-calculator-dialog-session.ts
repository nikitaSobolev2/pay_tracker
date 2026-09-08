"use client";

import { useState } from "react";

import {
  clearLinkedCalculatorBoardId,
  loadLinkedCalculatorBoardId,
  saveLinkedCalculatorBoardId,
} from "@/features/transaction-calculator/calculator-board-id";
import {
  EMPTY_CALCULATOR_SESSION,
  type CalculatorSession,
} from "@/features/transaction-calculator/calculator-session";
import {
  cloneCalculatorSession,
  serializeCalculatorSession,
} from "@/features/transaction-calculator/calculator-storage";
import { useCalculatorSession } from "@/features/transaction-calculator/use-calculator-session";

export type CalculatorDialogMode = "draft" | "board";

type DialogSessionInput = {
  readonly mode: CalculatorDialogMode;
  readonly userId: string | null;
  readonly initialSession?: CalculatorSession;
};

export function useCalculatorDialogSession(input: DialogSessionInput): {
  session: CalculatorSession;
  setSession: (next: CalculatorSession) => void;
  linkedBoardId: string | null;
  rememberBoardId: (boardId: string) => void;
  clearDraft: () => void;
  isDirty: boolean;
  markClean: () => void;
} {
  const draft = useCalculatorSession(
    input.mode === "draft" ? input.userId : null,
  );
  const board = useBoardCopy(input);
  const linked = useLinkedBoardId(input.mode === "draft" ? input.userId : null);
  if (input.mode === "board") {
    return {
      session: board.session,
      setSession: board.setSession,
      linkedBoardId: null,
      rememberBoardId: () => undefined,
      clearDraft: () => undefined,
      isDirty: board.isDirty,
      markClean: board.markClean,
    };
  }
  return {
    session: draft.session,
    setSession: draft.setSession,
    linkedBoardId: linked.boardId,
    rememberBoardId: linked.rememberBoardId,
    clearDraft: linked.clearDraft,
    isDirty: false,
    markClean: () => undefined,
  };
}

function useBoardCopy(input: DialogSessionInput): {
  session: CalculatorSession;
  setSession: (next: CalculatorSession) => void;
  isDirty: boolean;
  markClean: () => void;
} {
  const [boardSession, setBoardSession] = useState(() =>
    cloneCalculatorSession(input.initialSession ?? EMPTY_CALCULATOR_SESSION),
  );
  const [snapshot, setSnapshot] = useState(() =>
    serializeCalculatorSession(boardSession),
  );
  return {
    session: boardSession,
    setSession: setBoardSession,
    isDirty: serializeCalculatorSession(boardSession) !== snapshot,
    markClean: () => {
      setSnapshot(serializeCalculatorSession(boardSession));
    },
  };
}

function useLinkedBoardId(userId: string | null): {
  boardId: string | null;
  rememberBoardId: (boardId: string) => void;
  clearDraft: () => void;
} {
  const [state, setState] = useState<{
    userId: string | null;
    boardId: string | null;
  }>({
    userId: null,
    boardId: null,
  });
  if (userId !== state.userId) {
    setState({
      userId,
      boardId: loadLinkedCalculatorBoardId(userId),
    });
  }
  function rememberBoardId(boardId: string) {
    if (!userId) {
      return;
    }
    saveLinkedCalculatorBoardId(userId, boardId);
    setState({ userId, boardId });
  }
  function clearDraft() {
    if (userId) {
      clearLinkedCalculatorBoardId(userId);
    }
    setState({ userId, boardId: null });
  }
  return {
    boardId: state.boardId,
    rememberBoardId,
    clearDraft,
  };
}
