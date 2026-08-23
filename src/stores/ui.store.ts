import { create } from "zustand";

import { TransactionFormMode, TransactionType } from "@/types/enums";
import type { TransactionDto } from "@/types/transaction";

export type OpenTransactionModalOptions = {
  readonly travelId?: string | null;
};

type UiStore = {
  transactionModalOpen: boolean;
  transactionFormMode: TransactionFormMode;
  editingTransaction: TransactionDto | null;
  dividingTransaction: TransactionDto | null;
  preferredTravelId: string | null;
  openTransactionModal: (
    mode: TransactionFormMode,
    options?: OpenTransactionModalOptions,
  ) => void;
  openEditTransactionModal: (transaction: TransactionDto) => void;
  openDivideTransactionModal: (transaction: TransactionDto) => void;
  closeDivideTransactionModal: () => void;
  closeTransactionModal: () => void;
  setTransactionFormMode: (mode: TransactionFormMode) => void;
};

export const useUiStore = create<UiStore>((set) => ({
  transactionModalOpen: false,
  transactionFormMode: TransactionFormMode.Spending,
  editingTransaction: null,
  dividingTransaction: null,
  preferredTravelId: null,
  openTransactionModal: (mode, options) =>
    set({
      transactionModalOpen: true,
      transactionFormMode: mode,
      editingTransaction: null,
      preferredTravelId: options?.travelId ?? null,
    }),
  openEditTransactionModal: (transaction) =>
    set({
      transactionModalOpen: true,
      transactionFormMode:
        transaction.type === TransactionType.Spending
          ? TransactionFormMode.Spending
          : TransactionFormMode.Earning,
      editingTransaction: transaction,
      preferredTravelId: transaction.travelId,
    }),
  openDivideTransactionModal: (transaction) =>
    set({ dividingTransaction: transaction }),
  closeDivideTransactionModal: () => set({ dividingTransaction: null }),
  closeTransactionModal: () =>
    set({
      transactionModalOpen: false,
      editingTransaction: null,
      preferredTravelId: null,
    }),
  setTransactionFormMode: (mode) => set({ transactionFormMode: mode }),
}));
