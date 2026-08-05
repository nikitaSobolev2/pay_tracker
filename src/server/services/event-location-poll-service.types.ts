import type {
  EventPollSelectionMode,
  EventPollStatus,
} from "@/types/enums";

export type PollOptionInput = {
  readonly id?: string | null;
  readonly title: string;
  readonly link?: string | null;
  readonly address?: string | null;
  readonly latitude?: number | null;
  readonly longitude?: number | null;
};

export type EventLocationPollOptionDto = {
  readonly id: string;
  readonly title: string;
  readonly link: string | null;
  readonly address: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly imageUrl: string | null;
  readonly sortOrder: number;
  readonly voteCount: number;
  readonly percent: number;
  readonly authorGuestId: string | null;
  readonly authorUserId: string | null;
  readonly authorName: string | null;
};

export type EventLocationPollVoterDto = {
  readonly key: string;
  readonly name: string;
  readonly optionIds: readonly string[];
  readonly isOwner: boolean;
};

export type EventLocationPollDto = {
  readonly id: string;
  readonly eventId: string;
  readonly title: string;
  readonly selectionMode: EventPollSelectionMode;
  readonly endsAt: string | null;
  readonly status: EventPollStatus;
  readonly finishedOptionId: string | null;
  readonly needsOwnerPick: boolean;
  readonly totalVotes: number;
  readonly options: readonly EventLocationPollOptionDto[];
  readonly voters: readonly EventLocationPollVoterDto[];
  readonly viewerVoteOptionIds: readonly string[];
  readonly createdAt: string;
};

export type FinishPollResult =
  | {
      readonly kind: "finished";
      readonly poll: EventLocationPollDto;
    }
  | {
      readonly kind: "needsPick";
      readonly optionIds: readonly string[];
      readonly poll: EventLocationPollDto;
    };
