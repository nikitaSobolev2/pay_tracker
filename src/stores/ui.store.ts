import { create } from "zustand";

import { TransactionFormMode, TransactionType } from "@/types/enums";
import type { TransactionDto } from "@/types/transaction";

type UiStore = {
  transactionModalOpen: boolean;
  transactionFormMode: TransactionFormMode;
  editingTransaction: TransactionDto | null;
  openTransactionModal: (mode: TransactionFormMode) => void;
  openEditTransactionModal: (transaction: TransactionDto) => void;
  closeTransactionModal: () => void;
  setTransactionFormMode: (mode: TransactionFormMode) => void;
};

export const useUiStore = create<UiStore>((set) => ({
  transactionModalOpen: false,
  transactionFormMode: TransactionFormMode.Spending,
  editingTransaction: null,
  openTransactionModal: (mode) =>
    set({
      transactionModalOpen: true,
      transactionFormMode: mode,
      editingTransaction: null,
    }),
  openEditTransactionModal: (transaction) =>
    set({
      transactionModalOpen: true,
      transactionFormMode:
        transaction.type === TransactionType.Spending
          ? TransactionFormMode.Spending
          : TransactionFormMode.Earning,
      editingTransaction: transaction,
    }),
  closeTransactionModal: () =>
    set({
      transactionModalOpen: false,
      editingTransaction: null,
    }),
  setTransactionFormMode: (mode) => set({ transactionFormMode: mode }),
}));
