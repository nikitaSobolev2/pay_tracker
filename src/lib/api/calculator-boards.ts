import type { CalculatorBoardQuery } from "@/features/transaction-calculator/calculator-board-payload";
import type { CalculatorSession } from "@/features/transaction-calculator/calculator-session";
import { calculatorSessionToJson } from "@/features/transaction-calculator/calculator-storage";
import { apiFetch } from "@/lib/api/client";

export type CalculatorBoardListItem = {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
};

export type CalculatorBoardDto = {
  readonly id: string;
  readonly title: string;
  readonly query: CalculatorBoardQuery;
  readonly session: CalculatorSession;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export function listCalculatorBoards() {
  return apiFetch<{ boards: CalculatorBoardListItem[] }>(
    "/api/calculator-boards",
  );
}

export function getCalculatorBoard(id: string) {
  return apiFetch<{ board: CalculatorBoardDto }>(
    `/api/calculator-boards/${id}`,
  );
}

export function createCalculatorBoard(input: {
  readonly title: string;
  readonly query: CalculatorBoardQuery;
  readonly session: CalculatorSession;
}) {
  return apiFetch<{ board: CalculatorBoardDto }>("/api/calculator-boards", {
    method: "POST",
    body: {
      title: input.title,
      query: input.query,
      session: calculatorSessionToJson(input.session),
    },
  });
}

export function updateCalculatorBoard(
  id: string,
  input: {
    readonly title?: string;
    readonly query?: CalculatorBoardQuery;
    readonly session?: CalculatorSession;
  },
) {
  return apiFetch<{ board: CalculatorBoardDto }>(
    `/api/calculator-boards/${id}`,
    {
      method: "PATCH",
      body: {
        title: input.title,
        query: input.query,
        session:
          input.session === undefined
            ? undefined
            : calculatorSessionToJson(input.session),
      },
    },
  );
}

export function deleteCalculatorBoard(id: string) {
  return apiFetch<{ ok: true }>(`/api/calculator-boards/${id}`, {
    method: "DELETE",
  });
}
