/**
 * Pure helpers for location-poll tallies and winner resolution.
 * Kept free of Prisma so unit tests stay fast.
 */

export type PollOptionTally = {
  readonly optionId: string;
  readonly voteCount: number;
};

export type WinnerResolution =
  | { readonly kind: "unique"; readonly optionId: string }
  | { readonly kind: "tie"; readonly optionIds: readonly string[] }
  | { readonly kind: "empty" };

export function tallyVotesByOption(
  votes: readonly { readonly optionId: string }[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const vote of votes) {
    counts.set(vote.optionId, (counts.get(vote.optionId) ?? 0) + 1);
  }
  return counts;
}

export function resolvePollWinner(
  optionIds: readonly string[],
  votes: readonly { readonly optionId: string }[],
): WinnerResolution {
  if (optionIds.length === 0) {
    return { kind: "empty" };
  }

  const counts = tallyVotesByOption(votes);
  let max = -1;
  for (const optionId of optionIds) {
    max = Math.max(max, counts.get(optionId) ?? 0);
  }

  const leaders = optionIds.filter((id) => (counts.get(id) ?? 0) === max);
  if (leaders.length === 0) {
    return { kind: "empty" };
  }
  if (leaders.length === 1) {
    return { kind: "unique", optionId: leaders[0]! };
  }
  return { kind: "tie", optionIds: leaders };
}

export function votePercent(voteCount: number, totalVotes: number): number {
  if (totalVotes <= 0) {
    return 0;
  }
  return Math.round((voteCount / totalVotes) * 10_000) / 100;
}
