import type {
  TravelAiReportType,
  TravelPhase,
  TravelPlannedCategory,
} from "@/types/enums";
import type { TransactionDto } from "@/types/transaction";

export type TravelPlannedSpendingDto = {
  readonly id: string;
  readonly travelId: string;
  readonly title: string;
  readonly category: TravelPlannedCategory;
  readonly amount: string;
  readonly note: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type TravelCategoryBudgetDto = {
  readonly category: TravelPlannedCategory;
  readonly amount: string;
};

export type TravelPlaceToVisitDto = {
  readonly id: string;
  readonly travelId: string;
  readonly title: string;
  readonly link: string | null;
  readonly address: string | null;
  readonly isChecked: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type TravelThingToGrabDto = {
  readonly id: string;
  readonly travelId: string;
  readonly title: string;
  readonly amount: number;
  readonly isChecked: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type TravelTicketDto = {
  readonly id: string;
  readonly travelId: string;
  readonly title: string;
  readonly fileUrl: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly origin: string | null;
  readonly destination: string | null;
  readonly departsAt: string | null;
  readonly arrivesAt: string | null;
  readonly ticketNumber: string | null;
  readonly flightNumber: string | null;
  readonly bookingCode: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type TravelTicketSegmentFields = {
  readonly origin?: string | null;
  readonly destination?: string | null;
  readonly departsAt?: Date | null;
  readonly arrivesAt?: Date | null;
  readonly ticketNumber?: string | null;
  readonly flightNumber?: string | null;
  readonly bookingCode?: string | null;
};

export type TravelAiReportDto = {
  readonly id: string;
  readonly type: TravelAiReportType;
  readonly reportMessage: string;
  readonly contextMessage: string | null;
  readonly responseLocale: string | null;
  readonly extras: unknown;
  readonly model: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type TravelSummaryDto = {
  readonly plannedTotal: string;
  readonly plannedByCategory: Readonly<Record<TravelPlannedCategory, string>>;
  readonly fixedPlannedTotal: string;
  readonly flexiblePlannedTotal: string;
  readonly actualTotal: string;
  readonly avgPlannedPerDay: string;
  readonly avgActualPerDay: string;
  readonly tripDays: number;
  readonly maxSpendingGoal: string | null;
};

export type TravelListItemDto = {
  readonly id: string;
  readonly title: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly imageUrl: string | null;
  readonly placeLabel: string | null;
  readonly placeCountry: string | null;
  readonly placeCity: string | null;
  readonly currency: string;
  readonly phase: TravelPhase;
  readonly phaseOverride: TravelPhase | null;
  readonly maxSpendingGoal: string | null;
  readonly plannedTotal: string;
  readonly actualTotal: string;
};

export type TravelDetailDto = TravelListItemDto & {
  readonly placeCountry: string | null;
  readonly placeCity: string | null;
  readonly housingAddress: string | null;
  readonly housingLatitude: number | null;
  readonly housingLongitude: number | null;
  readonly housingFloor: string | null;
  readonly housingEntrance: string | null;
  readonly housingApartment: string | null;
  readonly plannedSpendings: TravelPlannedSpendingDto[];
  readonly categoryBudgets: TravelCategoryBudgetDto[];
  readonly placesToVisit: TravelPlaceToVisitDto[];
  readonly thingsToGrab: TravelThingToGrabDto[];
  readonly tickets: TravelTicketDto[];
  readonly summary: TravelSummaryDto;
  readonly aiReport: TravelAiReportDto | null;
};

export type TravelSuggestItemDto = {
  readonly id: string;
  readonly title: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly placeLabel: string | null;
  readonly imageUrl: string | null;
  readonly phase: TravelPhase;
  readonly currency: string;
};

export type CreateTravelInput = {
  readonly userId: string;
  readonly title: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly imageUrl?: string | null;
  readonly placeCountry?: string | null;
  readonly placeCity?: string | null;
  readonly placeLabel?: string | null;
  readonly housingAddress?: string | null;
  readonly housingLatitude?: number | null;
  readonly housingLongitude?: number | null;
  readonly housingFloor?: string | null;
  readonly housingEntrance?: string | null;
  readonly housingApartment?: string | null;
  readonly currency: string;
  readonly maxSpendingGoal?: string | null;
};

export type UpdateTravelInput = {
  readonly userId: string;
  readonly travelId: string;
  readonly title?: string;
  readonly startsAt?: Date;
  readonly endsAt?: Date;
  readonly imageUrl?: string | null;
  readonly placeCountry?: string | null;
  readonly placeCity?: string | null;
  readonly placeLabel?: string | null;
  readonly housingAddress?: string | null;
  readonly housingLatitude?: number | null;
  readonly housingLongitude?: number | null;
  readonly housingFloor?: string | null;
  readonly housingEntrance?: string | null;
  readonly housingApartment?: string | null;
  readonly maxSpendingGoal?: string | null;
  readonly phaseOverride?: TravelPhase | null;
  readonly clearPhaseOverride?: boolean;
};

export type CreatePlannedSpendingInput = {
  readonly userId: string;
  readonly travelId: string;
  readonly title: string;
  readonly category: TravelPlannedCategory;
  readonly amount: string;
  readonly note?: string | null;
};

export type UpsertCategoryBudgetInput = {
  readonly userId: string;
  readonly travelId: string;
  readonly category: TravelPlannedCategory;
  readonly amount: string | null;
};

export type UpdatePlannedSpendingInput = {
  readonly userId: string;
  readonly travelId: string;
  readonly spendingId: string;
  readonly title?: string;
  readonly category?: TravelPlannedCategory;
  readonly amount?: string;
  readonly note?: string | null;
};

export type CreatePlaceToVisitInput = {
  readonly userId: string;
  readonly travelId: string;
  readonly title: string;
  readonly link?: string | null;
  readonly address?: string | null;
};

export type UpdatePlaceToVisitInput = {
  readonly userId: string;
  readonly travelId: string;
  readonly placeId: string;
  readonly title?: string;
  readonly link?: string | null;
  readonly address?: string | null;
  readonly isChecked?: boolean;
};

export type CreateThingToGrabInput = {
  readonly userId: string;
  readonly travelId: string;
  readonly title: string;
  readonly amount: number;
};

export type UpdateThingToGrabInput = {
  readonly userId: string;
  readonly travelId: string;
  readonly itemId: string;
  readonly title?: string;
  readonly amount?: number;
  readonly isChecked?: boolean;
};

export type CreateTravelTicketInput = TravelTicketSegmentFields & {
  readonly userId: string;
  readonly travelId: string;
  readonly title: string;
  readonly fileUrl: string;
  readonly fileName: string;
  readonly contentType: string;
};

export type UpdateTravelTicketInput = {
  readonly userId: string;
  readonly travelId: string;
  readonly ticketId: string;
  readonly title?: string;
};

export type TravelTransactionsPage = {
  readonly items: TransactionDto[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
};
