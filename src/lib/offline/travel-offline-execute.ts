"use client";

import { ApiClientError } from "@/lib/api/client";
import {
  createPlaceToVisit,
  createPlannedSpending,
  createThingToGrab,
  createTravelTicket,
  deletePlaceToVisit,
  deletePlannedSpending,
  deleteThingToGrab,
  deleteTravelTicket,
  updatePlaceToVisit,
  updatePlannedSpending,
  updateThingToGrab,
  updateTravel,
  updateTravelTicket,
  uploadTravelCover,
  uploadTravelTicketFile,
  upsertCategoryBudget,
} from "@/lib/api/travels";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/lib/api/transactions";
import {
  deleteTravelOfflineFile,
  fileFromOfflineRecord,
  getTravelOfflineFile,
} from "@/lib/offline/travel-offline-files";
import { useTravelCacheStore } from "@/stores/travel-cache.store";
import type { TravelOfflineQueueItem } from "@/stores/travel-offline-queue.types";

export type TravelOfflineRemap = {
  kind: "place" | "thing" | "planned" | "ticket" | "transaction";
  localId: string;
  serverId: string;
};

export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }
  if (error instanceof ApiClientError) {
    // status 0 = fetch threw (offline / connection reset)
    return error.status === 0;
  }
  if (error instanceof TypeError) {
    return true;
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("failed to fetch") ||
      message.includes("networkerror") ||
      message.includes("network request failed") ||
      message.includes("load failed")
    );
  }
  return false;
}

export async function executeTravelOfflineOp(
  item: TravelOfflineQueueItem,
): Promise<TravelOfflineRemap[]> {
  const { travelId, op } = item;
  const cache = useTravelCacheStore.getState();
  const remaps: TravelOfflineRemap[] = [];

  switch (op.kind) {
    case "updateTravel": {
      const result = await updateTravel(travelId, op.body);
      cache.putTravel(result.travel);
      break;
    }
    case "createPlace": {
      const result = await createPlaceToVisit(travelId, op.body);
      remaps.push({
        kind: "place",
        localId: op.entityLocalId,
        serverId: result.place.id,
      });
      cache.remapEntityId(travelId, "place", op.entityLocalId, result.place.id);
      break;
    }
    case "updatePlace": {
      await updatePlaceToVisit(travelId, op.entityId, op.body);
      break;
    }
    case "deletePlace": {
      await deletePlaceToVisit(travelId, op.entityId);
      break;
    }
    case "createThing": {
      const result = await createThingToGrab(travelId, op.body);
      remaps.push({
        kind: "thing",
        localId: op.entityLocalId,
        serverId: result.item.id,
      });
      cache.remapEntityId(travelId, "thing", op.entityLocalId, result.item.id);
      break;
    }
    case "updateThing": {
      await updateThingToGrab(travelId, op.entityId, op.body);
      break;
    }
    case "deleteThing": {
      await deleteThingToGrab(travelId, op.entityId);
      break;
    }
    case "createPlanned": {
      const result = await createPlannedSpending(travelId, op.body);
      remaps.push({
        kind: "planned",
        localId: op.entityLocalId,
        serverId: result.spending.id,
      });
      cache.remapEntityId(
        travelId,
        "planned",
        op.entityLocalId,
        result.spending.id,
      );
      break;
    }
    case "updatePlanned": {
      await updatePlannedSpending(travelId, op.entityId, op.body);
      break;
    }
    case "deletePlanned": {
      await deletePlannedSpending(travelId, op.entityId);
      break;
    }
    case "upsertCategoryBudget": {
      await upsertCategoryBudget(travelId, {
        category: op.category,
        amount: op.amount,
      });
      break;
    }
    case "createTicket": {
      const fileRecord = await getTravelOfflineFile(op.fileId);
      if (!fileRecord) {
        throw new Error("Queued ticket file missing");
      }
      const uploaded = await uploadTravelTicketFile(
        fileFromOfflineRecord(fileRecord),
      );
      const result = await createTravelTicket(travelId, {
        title: op.title,
        fileUrl: uploaded.url,
        fileName: uploaded.fileName,
        contentType: uploaded.contentType,
      });
      remaps.push({
        kind: "ticket",
        localId: op.entityLocalId,
        serverId: result.ticket.id,
      });
      cache.remapEntityId(
        travelId,
        "ticket",
        op.entityLocalId,
        result.ticket.id,
      );
      cache.patchTravel(travelId, (current) => ({
        ...current,
        tickets: current.tickets.map((ticket) =>
          ticket.id === result.ticket.id ? result.ticket : ticket,
        ),
      }));
      await deleteTravelOfflineFile(op.fileId);
      break;
    }
    case "updateTicket": {
      await updateTravelTicket(travelId, op.entityId, { title: op.title });
      break;
    }
    case "deleteTicket": {
      await deleteTravelTicket(travelId, op.entityId);
      break;
    }
    case "uploadCover": {
      const fileRecord = await getTravelOfflineFile(op.fileId);
      if (!fileRecord) {
        throw new Error("Queued cover file missing");
      }
      const uploaded = await uploadTravelCover(
        fileFromOfflineRecord(fileRecord),
      );
      const result = await updateTravel(travelId, {
        imageUrl: uploaded.url,
      });
      cache.putTravel(result.travel);
      await deleteTravelOfflineFile(op.fileId);
      break;
    }
    case "createTransaction": {
      const result = await createTransaction(op.body);
      remaps.push({
        kind: "transaction",
        localId: op.entityLocalId,
        serverId: result.transaction.id,
      });
      cache.remapEntityId(
        travelId,
        "transaction",
        op.entityLocalId,
        result.transaction.id,
      );
      cache.upsertTransaction(travelId, result.transaction);
      break;
    }
    case "updateTransaction": {
      const result = await updateTransaction(op.entityId, op.body);
      cache.upsertTransaction(travelId, result.transaction);
      break;
    }
    case "deleteTransaction": {
      await deleteTransaction(op.entityId);
      cache.removeTransaction(travelId, op.entityId);
      break;
    }
    default: {
      const _exhaustive: never = op;
      throw new Error(`Unknown offline op: ${JSON.stringify(_exhaustive)}`);
    }
  }

  return remaps;
}
