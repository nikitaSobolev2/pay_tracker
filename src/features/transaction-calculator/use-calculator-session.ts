"use client";

import { useEffect, useState } from "react";

import {
  EMPTY_CALCULATOR_SESSION,
  type CalculatorSession,
} from "@/features/transaction-calculator/calculator-session";
import {
  calculatorStorageKey,
  parseCalculatorSession,
  serializeCalculatorSession,
} from "@/features/transaction-calculator/calculator-storage";

type SessionState = {
  readonly userId: string | null;
  readonly session: CalculatorSession;
};

export function useCalculatorSession(userId: string | null): {
  session: CalculatorSession;
  setSession: (next: CalculatorSession) => void;
} {
  const [state, setState] = useState<SessionState>({
    userId: null,
    session: EMPTY_CALCULATOR_SESSION,
  });

  if (userId !== state.userId) {
    setState({
      userId,
      session: loadCalculatorSession(userId),
    });
  }

  useEffect(() => {
    if (!state.userId) {
      return;
    }
    window.localStorage.setItem(
      calculatorStorageKey(state.userId),
      serializeCalculatorSession(state.session),
    );
  }, [state]);

  function setSession(session: CalculatorSession) {
    setState((current) => ({ ...current, session }));
  }

  return { session: state.session, setSession };
}

function loadCalculatorSession(userId: string | null): CalculatorSession {
  if (!userId || typeof window === "undefined") {
    return EMPTY_CALCULATOR_SESSION;
  }
  return parseCalculatorSession(
    window.localStorage.getItem(calculatorStorageKey(userId)),
  );
}
