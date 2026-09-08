const BOARD_ID_KEY_PREFIX = "paytracker:calculator-board-id:";

export function calculatorBoardIdStorageKey(userId: string): string {
  return `${BOARD_ID_KEY_PREFIX}${userId}`;
}

export function linkedCalculatorBoardSave(
  linkedBoardId: string | null,
): "create" | "update" {
  return linkedBoardId ? "update" : "create";
}

export function loadLinkedCalculatorBoardId(
  userId: string | null,
): string | null {
  if (!userId) {
    return null;
  }
  const value = readLocalStorage(calculatorBoardIdStorageKey(userId));
  return value && value.length > 0 ? value : null;
}

export function saveLinkedCalculatorBoardId(
  userId: string,
  boardId: string,
): void {
  writeLocalStorage(calculatorBoardIdStorageKey(userId), boardId);
}

export function clearLinkedCalculatorBoardId(userId: string): void {
  removeLocalStorage(calculatorBoardIdStorageKey(userId));
}

function readLocalStorage(key: string): string | null {
  return storageOrNull()?.getItem(key) ?? null;
}

function writeLocalStorage(key: string, value: string): void {
  storageOrNull()?.setItem(key, value);
}

function removeLocalStorage(key: string): void {
  storageOrNull()?.removeItem(key);
}

function storageOrNull(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
}
