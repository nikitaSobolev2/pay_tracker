import { TravelPhase } from "@/types/enums";

export type FastEnterTravel = {
  readonly id: string;
  readonly phase: TravelPhase;
};

/** Fast enter attaches spending to travel only while the trip is in progress. */
export function travelIdForFastEnter(
  travel: FastEnterTravel | null | undefined,
): string | null {
  if (!travel || travel.phase !== TravelPhase.InProgress) {
    return null;
  }
  return travel.id;
}
