import { toIntegerAmountString } from "@/lib/money";
import type {
  TravelOfflineOp,
  TravelOfflineQueueItem,
} from "@/stores/travel-offline-queue.types";
import { FastQueueStatus } from "@/types/enums";

function isOpenStatus(status: FastQueueStatus): boolean {
  return (
    status === FastQueueStatus.Pending || status === FastQueueStatus.Error
  );
}

function mergeDefined<T extends object>(base: T, patch: Partial<T>): T {
  const next: T = { ...base };
  for (const key of Object.keys(patch) as (keyof T)[]) {
    const value = patch[key];
    if (value !== undefined) {
      next[key] = value as T[keyof T];
    }
  }
  return next;
}

function entityKey(op: TravelOfflineOp): string | null {
  switch (op.kind) {
    case "updatePlace":
    case "deletePlace":
      return `place:${op.entityId}`;
    case "createPlace":
      return `place:${op.entityLocalId}`;
    case "updateThing":
    case "deleteThing":
      return `thing:${op.entityId}`;
    case "createThing":
      return `thing:${op.entityLocalId}`;
    case "updatePlanned":
    case "deletePlanned":
      return `planned:${op.entityId}`;
    case "createPlanned":
      return `planned:${op.entityLocalId}`;
    case "updateTicket":
    case "deleteTicket":
      return `ticket:${op.entityId}`;
    case "createTicket":
      return `ticket:${op.entityLocalId}`;
    case "updateTransaction":
    case "deleteTransaction":
      return `transaction:${op.entityId}`;
    case "createTransaction":
      return `transaction:${op.entityLocalId}`;
    case "updateTravel":
      return "travel";
    case "upsertCategoryBudget":
      return `budget:${op.category}`;
    case "uploadCover":
      return "cover";
    default:
      return null;
  }
}

function isUpdateKind(kind: TravelOfflineOp["kind"]): boolean {
  return (
    kind === "updatePlace" ||
    kind === "updateThing" ||
    kind === "updatePlanned" ||
    kind === "updateTicket" ||
    kind === "updateTransaction" ||
    kind === "updateTravel"
  );
}

function isDeleteKind(kind: TravelOfflineOp["kind"]): boolean {
  return (
    kind === "deletePlace" ||
    kind === "deleteThing" ||
    kind === "deletePlanned" ||
    kind === "deleteTicket" ||
    kind === "deleteTransaction"
  );
}

function isCreateKind(kind: TravelOfflineOp["kind"]): boolean {
  return (
    kind === "createPlace" ||
    kind === "createThing" ||
    kind === "createPlanned" ||
    kind === "createTicket" ||
    kind === "createTransaction"
  );
}

function mergeUpdateIntoCreate(
  createOp: TravelOfflineOp,
  updateOp: TravelOfflineOp,
): TravelOfflineOp {
  if (
    createOp.kind === "createPlace" &&
    updateOp.kind === "updatePlace"
  ) {
    return {
      ...createOp,
      body: mergeDefined(createOp.body, updateOp.body),
    };
  }
  if (
    createOp.kind === "createThing" &&
    updateOp.kind === "updateThing"
  ) {
    return {
      ...createOp,
      body: mergeDefined(createOp.body, updateOp.body),
    };
  }
  if (
    createOp.kind === "createPlanned" &&
    updateOp.kind === "updatePlanned"
  ) {
    return {
      ...createOp,
      body: mergeDefined(createOp.body, updateOp.body),
    };
  }
  if (
    createOp.kind === "createTicket" &&
    updateOp.kind === "updateTicket"
  ) {
    return { ...createOp, title: updateOp.title };
  }
  if (
    createOp.kind === "createTransaction" &&
    updateOp.kind === "updateTransaction"
  ) {
    return {
      ...createOp,
      body: mergeDefined(createOp.body, updateOp.body),
    };
  }
  return createOp;
}

function mergeUpdateOps(
  existing: TravelOfflineOp,
  incoming: TravelOfflineOp,
): TravelOfflineOp {
  if (
    existing.kind === "updatePlace" &&
    incoming.kind === "updatePlace"
  ) {
    return {
      ...existing,
      body: mergeDefined(existing.body, incoming.body),
    };
  }
  if (
    existing.kind === "updateThing" &&
    incoming.kind === "updateThing"
  ) {
    return {
      ...existing,
      body: mergeDefined(existing.body, incoming.body),
    };
  }
  if (
    existing.kind === "updatePlanned" &&
    incoming.kind === "updatePlanned"
  ) {
    return {
      ...existing,
      body: mergeDefined(existing.body, incoming.body),
    };
  }
  if (
    existing.kind === "updateTravel" &&
    incoming.kind === "updateTravel"
  ) {
    return {
      ...existing,
      body: mergeDefined(existing.body, incoming.body),
    };
  }
  if (
    existing.kind === "updateTransaction" &&
    incoming.kind === "updateTransaction"
  ) {
    return {
      ...existing,
      body: mergeDefined(existing.body, incoming.body),
    };
  }
  if (
    existing.kind === "updateTicket" &&
    incoming.kind === "updateTicket"
  ) {
    return incoming;
  }
  if (
    existing.kind === "upsertCategoryBudget" &&
    incoming.kind === "upsertCategoryBudget"
  ) {
    return incoming;
  }
  if (existing.kind === "uploadCover" && incoming.kind === "uploadCover") {
    return incoming;
  }
  return incoming;
}

function updateBodyIsEmpty(op: TravelOfflineOp): boolean {
  if (!isUpdateKind(op.kind)) {
    return false;
  }
  if (op.kind === "updateTicket") {
    return op.title.trim() === "";
  }
  if (op.kind === "updateTravel") {
    return Object.values(op.body).every((value) => value === undefined);
  }
  if (
    op.kind === "updatePlace" ||
    op.kind === "updateThing" ||
    op.kind === "updatePlanned" ||
    op.kind === "updateTransaction"
  ) {
    return Object.values(op.body).every((value) => value === undefined);
  }
  return false;
}

function fieldValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (left == null && right == null) {
    return true;
  }
  if (typeof left === "string" && typeof right === "string") {
    if (left === right) {
      return true;
    }
    try {
      return toIntegerAmountString(left) === toIntegerAmountString(right);
    } catch {
      return false;
    }
  }
  return false;
}

function mergeBaselines(
  existing: Record<string, unknown> | undefined,
  incoming: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!existing && !incoming) {
    return undefined;
  }
  // First pending write wins per field (true pre-change snapshot).
  return { ...(incoming ?? {}), ...(existing ?? {}) };
}

/**
 * True when every field in the op matches the pre-change baseline — net no-op,
 * safe to drop from the queue (e.g. amount 100→200→100).
 */
export function travelOpMatchesBaseline(
  op: TravelOfflineOp,
  baseline: Record<string, unknown> | undefined,
): boolean {
  if (!baseline) {
    return false;
  }
  if (op.kind === "updateTicket") {
    return (
      Object.prototype.hasOwnProperty.call(baseline, "title") &&
      fieldValuesEqual(op.title, baseline.title)
    );
  }
  if (op.kind === "upsertCategoryBudget") {
    return (
      Object.prototype.hasOwnProperty.call(baseline, "amount") &&
      fieldValuesEqual(op.amount, baseline.amount)
    );
  }
  if (
    op.kind === "updatePlace" ||
    op.kind === "updateThing" ||
    op.kind === "updatePlanned" ||
    op.kind === "updateTravel" ||
    op.kind === "updateTransaction"
  ) {
    const entries = Object.entries(op.body).filter(
      ([, value]) => value !== undefined,
    );
    if (entries.length === 0) {
      return true;
    }
    return entries.every(
      ([key, value]) =>
        Object.prototype.hasOwnProperty.call(baseline, key) &&
        fieldValuesEqual(value, baseline[key]),
    );
  }
  return false;
}

/**
 * Fold a new queue item into open (pending/error) ops for the same entity so
 * sync sends one net change — not a stack of superseded patches.
 * Drops updates that revert to the pre-change baseline.
 */
export function coalesceTravelQueueItems(
  items: readonly TravelOfflineQueueItem[],
  incoming: TravelOfflineQueueItem,
  lockedLocalIds: ReadonlySet<string>,
): TravelOfflineQueueItem[] {
  if (updateBodyIsEmpty(incoming.op)) {
    return [...items];
  }

  const key = entityKey(incoming.op);
  if (key == null) {
    return [...items, incoming];
  }

  const openIndexes: number[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]!;
    if (item.travelId !== incoming.travelId) {
      continue;
    }
    if (!isOpenStatus(item.status) || lockedLocalIds.has(item.localId)) {
      continue;
    }
    if (entityKey(item.op) === key) {
      openIndexes.push(index);
    }
  }

  if (openIndexes.length === 0) {
    if (travelOpMatchesBaseline(incoming.op, incoming.baseline)) {
      return [...items];
    }
    return [...items, incoming];
  }

  // Delete cancels an unsynced create, or replaces open updates.
  if (isDeleteKind(incoming.op.kind)) {
    const createIndex = openIndexes.find((index) =>
      isCreateKind(items[index]!.op.kind),
    );
    if (createIndex != null) {
      return items.filter((_, index) => index !== createIndex);
    }
    const withoutOpen = items.filter(
      (_, index) => !openIndexes.includes(index),
    );
    return [...withoutOpen, incoming];
  }

  // Update merges into open create or latest open update.
  if (
    isUpdateKind(incoming.op.kind) ||
    incoming.op.kind === "upsertCategoryBudget" ||
    incoming.op.kind === "uploadCover"
  ) {
    const createIndex = openIndexes.find((index) =>
      isCreateKind(items[index]!.op.kind),
    );
    if (createIndex != null && isUpdateKind(incoming.op.kind)) {
      return items.map((item, index) =>
        index === createIndex
          ? {
              ...item,
              op: mergeUpdateIntoCreate(item.op, incoming.op),
              status: FastQueueStatus.Pending,
              errorMessage: undefined,
            }
          : item,
      );
    }

    const updateIndex = [...openIndexes]
      .reverse()
      .find((index) => {
        const kind = items[index]!.op.kind;
        return (
          isUpdateKind(kind) ||
          kind === "upsertCategoryBudget" ||
          kind === "uploadCover"
        );
      });
    if (updateIndex != null) {
      const existing = items[updateIndex]!;
      const mergedOp = mergeUpdateOps(existing.op, incoming.op);
      const baseline = mergeBaselines(existing.baseline, incoming.baseline);
      if (travelOpMatchesBaseline(mergedOp, baseline)) {
        return items.filter((_, index) => index !== updateIndex);
      }
      return items.map((item, index) =>
        index === updateIndex
          ? {
              ...item,
              op: mergedOp,
              baseline,
              status: FastQueueStatus.Pending,
              errorMessage: undefined,
            }
          : item,
      );
    }
  }

  return [...items, incoming];
}
