import type {
  PlaceToVisitBody,
  PlannedSpendingBody,
  ThingToGrabBody,
  TravelTicketSegmentBody,
  UpdateTravelBody,
} from "@/lib/api/travels";
import type { UpdateTransactionInput } from "@/lib/api/transactions";
import type { CreateTransactionInput } from "@/lib/api/transactions";
import type { TravelPlannedCategory } from "@/types/enums";
import type { FastQueueStatus } from "@/types/enums";

export type TravelOfflineOp =
  | {
      kind: "updateTravel";
      body: UpdateTravelBody;
    }
  | {
      kind: "createPlace";
      entityLocalId: string;
      body: PlaceToVisitBody;
    }
  | {
      kind: "updatePlace";
      entityId: string;
      body: Partial<PlaceToVisitBody>;
    }
  | {
      kind: "deletePlace";
      entityId: string;
    }
  | {
      kind: "createThing";
      entityLocalId: string;
      body: ThingToGrabBody;
    }
  | {
      kind: "updateThing";
      entityId: string;
      body: Partial<ThingToGrabBody>;
    }
  | {
      kind: "deleteThing";
      entityId: string;
    }
  | {
      kind: "createPlanned";
      entityLocalId: string;
      body: PlannedSpendingBody;
    }
  | {
      kind: "updatePlanned";
      entityId: string;
      body: Partial<PlannedSpendingBody>;
    }
  | {
      kind: "deletePlanned";
      entityId: string;
    }
  | {
      kind: "upsertCategoryBudget";
      category: TravelPlannedCategory;
      amount: string | null;
    }
  | {
      kind: "createTicket";
      entityLocalId: string;
      title: string;
      fileId: string;
      fileName: string;
      contentType: string;
      segment?: TravelTicketSegmentBody;
    }
  | {
      kind: "updateTicket";
      entityId: string;
      title: string;
    }
  | {
      kind: "deleteTicket";
      entityId: string;
    }
  | {
      kind: "uploadCover";
      fileId: string;
      fileName: string;
      contentType: string;
    }
  | {
      kind: "createTransaction";
      entityLocalId: string;
      body: CreateTransactionInput;
    }
  | {
      kind: "updateTransaction";
      entityId: string;
      body: UpdateTransactionInput;
    }
  | {
      kind: "deleteTransaction";
      entityId: string;
    };

export type TravelOfflineQueueItem = {
  localId: string;
  travelId: string;
  createdAtLocal: string;
  status: FastQueueStatus;
  errorMessage?: string;
  op: TravelOfflineOp;
  /**
   * Pre-change field snapshot for the first pending update on this entity.
   * When the coalesced op matches this baseline, the queue item is dropped.
   */
  baseline?: Record<string, unknown>;
};
