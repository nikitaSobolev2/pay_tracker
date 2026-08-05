import type { EventViewer } from "@/lib/event-access";
import { AppServiceError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { ApiErrorCode } from "@/types/api";
import {
  EventAuthorRole,
  EventPollSelectionMode,
  EventPollStatus,
} from "@/types/enums";
import { renameGuestUser } from "./guest-user-service";
import { bumpEventContent } from "./event-content-revision";
import {
  resolvePollWinner,
  tallyVotesByOption,
  votePercent,
} from "./event-location-poll-logic";
import { fetchLinkPreviewImage } from "./link-preview";
import type {
  EventLocationPollDto,
  EventLocationPollOptionDto,
  EventLocationPollVoterDto,
  FinishPollResult,
  PollOptionInput,
} from "./event-location-poll-service.types";

export type {
  EventLocationPollDto,
  EventLocationPollOptionDto,
  EventLocationPollVoterDto,
  FinishPollResult,
  PollOptionInput,
} from "./event-location-poll-service.types";

type PollAuthor = {
  readonly userId: string | null;
  readonly guestUserId: string | null;
};

export async function createLocationPoll(input: {
  readonly eventId: string;
  readonly title: string;
  readonly selectionMode: EventPollSelectionMode;
  readonly endsAt?: Date | null;
  readonly options: readonly PollOptionInput[];
  readonly author: PollAuthor;
}): Promise<EventLocationPollDto> {
  const open = await prisma.eventLocationPoll.findFirst({
    where: { eventId: input.eventId, status: EventPollStatus.Open },
    select: { id: true },
  });
  if (open) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "An open housing poll already exists",
    );
  }
  if (input.options.length < 1) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Add at least one option",
    );
  }

  const prepared = await Promise.all(
    input.options.map((option, index) => prepareOptionData(option, index, input.author)),
  );

  const poll = await prisma.eventLocationPoll.create({
    data: {
      eventId: input.eventId,
      title: input.title.trim(),
      selectionMode: input.selectionMode,
      endsAt: input.endsAt ?? null,
      options: { create: prepared },
    },
    select: { id: true },
  });
  await bumpEventContent(input.eventId);
  return loadPollDto(poll.id, input.author);
}

export async function updateLocationPoll(input: {
  readonly eventId: string;
  readonly pollId: string;
  readonly title: string;
  readonly selectionMode: EventPollSelectionMode;
  readonly endsAt?: Date | null;
  readonly options: readonly PollOptionInput[];
  readonly author: PollAuthor;
}): Promise<EventLocationPollDto> {
  if (input.options.length < 1) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Add at least one option",
    );
  }

  const poll = await prisma.eventLocationPoll.findFirst({
    where: { id: input.pollId, eventId: input.eventId },
    include: { options: { select: { id: true, imageUrl: true, link: true } } },
  });
  if (!poll) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Poll not found");
  }

  const existingById = new Map(
    poll.options.map((option) => [option.id, option]),
  );
  const keptIds = new Set(
    input.options
      .map((option) => option.id)
      .filter((id): id is string => typeof id === "string" && existingById.has(id)),
  );

  const preparedCreates: Awaited<ReturnType<typeof prepareOptionData>>[] = [];
  const preparedUpdates: Array<{
    readonly id: string;
    readonly title: string;
    readonly link: string | null;
    readonly address: string | null;
    readonly latitude: number | null;
    readonly longitude: number | null;
    readonly imageUrl: string | null;
    readonly sortOrder: number;
  }> = [];

  for (const [index, option] of input.options.entries()) {
    if (option.id && keptIds.has(option.id)) {
      const existing = existingById.get(option.id)!;
      const imageUrl =
        option.link !== undefined && emptyToNull(option.link) !== existing.link
          ? await imageForLink(option.link)
          : existing.imageUrl;
      preparedUpdates.push({
        id: option.id,
        title: option.title.trim(),
        link: emptyToNull(option.link),
        address: emptyToNull(option.address),
        latitude: option.latitude ?? null,
        longitude: option.longitude ?? null,
        imageUrl,
        sortOrder: index,
      });
      continue;
    }
    preparedCreates.push(await prepareOptionData(option, index, input.author));
  }

  const removedIds = [...existingById.keys()].filter((id) => !keptIds.has(id));

  await prisma.$transaction(async (tx) => {
    await tx.eventLocationPoll.update({
      where: { id: poll.id },
      data: {
        title: input.title.trim(),
        selectionMode: input.selectionMode,
        endsAt: input.endsAt ?? null,
        status: EventPollStatus.Open,
        finishedOptionId: null,
      },
    });

    if (removedIds.length > 0) {
      await tx.eventLocationPollOption.deleteMany({
        where: { pollId: poll.id, id: { in: removedIds } },
      });
    }

    for (const update of preparedUpdates) {
      await tx.eventLocationPollOption.update({
        where: { id: update.id },
        data: {
          title: update.title,
          link: update.link,
          address: update.address,
          latitude: update.latitude,
          longitude: update.longitude,
          imageUrl: update.imageUrl,
          sortOrder: update.sortOrder,
        },
      });
    }

    for (const create of preparedCreates) {
      await tx.eventLocationPollOption.create({
        data: { pollId: poll.id, ...create },
      });
    }
  });

  await bumpEventContent(input.eventId);
  return loadPollDto(poll.id, input.author);
}

export async function deleteLocationPoll(input: {
  readonly eventId: string;
  readonly pollId: string;
}): Promise<void> {
  const poll = await prisma.eventLocationPoll.findFirst({
    where: { id: input.pollId, eventId: input.eventId },
    select: { id: true },
  });
  if (!poll) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Poll not found");
  }
  await prisma.$transaction([
    prisma.eventLocationPoll.update({
      where: { id: poll.id },
      data: { finishedOptionId: null },
    }),
    prisma.eventLocationPoll.delete({ where: { id: poll.id } }),
  ]);
  await bumpEventContent(input.eventId);
}

export async function addPollOption(input: {
  readonly eventId: string;
  readonly pollId: string;
  readonly option: PollOptionInput;
  readonly author: PollAuthor;
  readonly viewer: EventViewer;
}): Promise<EventLocationPollDto> {
  const poll = await requireMutablePoll(
    input.eventId,
    input.pollId,
    input.viewer,
  );
  const sortOrder =
    (await prisma.eventLocationPollOption.count({ where: { pollId: poll.id } }));
  const data = await prepareOptionData(input.option, sortOrder, input.author);
  await prisma.eventLocationPollOption.create({
    data: { pollId: poll.id, ...data },
  });
  await bumpEventContent(input.eventId);
  return loadPollDto(poll.id, input.author);
}

export async function updatePollOption(input: {
  readonly eventId: string;
  readonly pollId: string;
  readonly optionId: string;
  readonly option: PollOptionInput;
  readonly viewer: EventViewer;
}): Promise<EventLocationPollDto> {
  const poll = await requireMutablePoll(
    input.eventId,
    input.pollId,
    input.viewer,
  );
  const existing = await prisma.eventLocationPollOption.findFirst({
    where: { id: input.optionId, pollId: poll.id },
  });
  if (!existing) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Option not found");
  }
  assertCanMutateOption(input.viewer, existing);
  const imageUrl =
    input.option.link !== undefined
      ? await imageForLink(input.option.link)
      : existing.imageUrl;

  await prisma.eventLocationPollOption.update({
    where: { id: existing.id },
    data: {
      title: input.option.title.trim(),
      link: emptyToNull(input.option.link),
      address: emptyToNull(input.option.address),
      latitude: input.option.latitude ?? null,
      longitude: input.option.longitude ?? null,
      imageUrl,
    },
  });
  await bumpEventContent(input.eventId);
  return loadPollDto(poll.id, viewerAsAuthor(input.viewer));
}

export async function deletePollOption(input: {
  readonly eventId: string;
  readonly pollId: string;
  readonly optionId: string;
  readonly viewer: EventViewer;
}): Promise<EventLocationPollDto> {
  const poll = await requireMutablePoll(
    input.eventId,
    input.pollId,
    input.viewer,
  );
  const existing = await prisma.eventLocationPollOption.findFirst({
    where: { id: input.optionId, pollId: poll.id },
  });
  if (!existing) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Option not found");
  }
  assertCanMutateOption(input.viewer, existing);
  if (poll.finishedOptionId === existing.id) {
    await prisma.eventLocationPoll.update({
      where: { id: poll.id },
      data: { finishedOptionId: null },
    });
  }
  await prisma.eventLocationPollOption.delete({ where: { id: existing.id } });
  await bumpEventContent(input.eventId);
  return loadPollDto(poll.id, viewerAsAuthor(input.viewer));
}

export async function setPollVotes(input: {
  readonly eventId: string;
  readonly pollId: string;
  readonly optionIds: readonly string[];
  readonly viewer: EventViewer;
}): Promise<EventLocationPollDto> {
  const poll = await requireOpenPoll(input.eventId, input.pollId);
  assertVotingOpen(poll.endsAt);

  const optionIds = [...new Set(input.optionIds)];
  if (
    poll.selectionMode === EventPollSelectionMode.Single &&
    optionIds.length > 1
  ) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "This poll allows only one choice",
    );
  }

  const validOptions = await prisma.eventLocationPollOption.findMany({
    where: { pollId: poll.id, id: { in: optionIds } },
    select: { id: true },
  });
  if (validOptions.length !== optionIds.length) {
    throw new AppServiceError(ApiErrorCode.Validation, "Unknown poll option");
  }

  const voter = voterFilter(input.viewer);
  await prisma.$transaction(async (tx) => {
    await tx.eventLocationPollVote.deleteMany({
      where: { pollId: poll.id, ...voter },
    });
    if (optionIds.length === 0) {
      return;
    }
    await tx.eventLocationPollVote.createMany({
      data: optionIds.map((optionId) => ({
        pollId: poll.id,
        optionId,
        voterUserId: input.viewer.userId,
        voterGuestId: input.viewer.guestUserId,
      })),
    });
  });
  await bumpEventContent(input.eventId);
  return loadPollDto(poll.id, viewerAsAuthor(input.viewer));
}

export async function finishLocationPoll(input: {
  readonly eventId: string;
  readonly pollId: string;
  readonly chosenOptionId?: string | null;
}): Promise<FinishPollResult> {
  const poll = await prisma.eventLocationPoll.findFirst({
    where: { id: input.pollId, eventId: input.eventId },
    include: {
      options: { select: { id: true, address: true, latitude: true, longitude: true } },
      votes: { select: { optionId: true } },
    },
  });
  if (!poll) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Poll not found");
  }
  if (poll.status !== EventPollStatus.Open) {
    throw new AppServiceError(ApiErrorCode.Validation, "Poll already finished");
  }

  const optionIds = poll.options.map((option) => option.id);
  const resolution = resolvePollWinner(optionIds, poll.votes);

  let winnerId: string | null = null;
  if (input.chosenOptionId) {
    if (!optionIds.includes(input.chosenOptionId)) {
      throw new AppServiceError(ApiErrorCode.Validation, "Unknown poll option");
    }
    winnerId = input.chosenOptionId;
  } else if (resolution.kind === "unique") {
    winnerId = resolution.optionId;
  } else if (resolution.kind === "tie") {
    return {
      kind: "needsPick",
      optionIds: resolution.optionIds,
      poll: await loadPollDto(poll.id, { userId: null, guestUserId: null }),
    };
  } else {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Poll has no options to finish",
    );
  }

  const winner = poll.options.find((option) => option.id === winnerId);
  if (!winner) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Winning option not found");
  }

  await prisma.$transaction([
    prisma.event.update({
      where: { id: input.eventId },
      data: {
        address: winner.address,
        latitude: winner.latitude,
        longitude: winner.longitude,
      },
    }),
    prisma.eventLocationPoll.update({
      where: { id: poll.id },
      data: {
        status: EventPollStatus.Finished,
        finishedOptionId: winner.id,
      },
    }),
  ]);
  await bumpEventContent(input.eventId);
  return {
    kind: "finished",
    poll: await loadPollDto(poll.id, { userId: null, guestUserId: null }),
  };
}

/** Latest poll for the event (open preferred, else most recent finished). */
export async function getLocationPollForEvent(
  eventId: string,
  viewer: PollAuthor,
): Promise<EventLocationPollDto | null> {
  const open = await prisma.eventLocationPoll.findFirst({
    where: { eventId, status: EventPollStatus.Open },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (open) {
    return maybeAutoResolveExpired(open.id, eventId, viewer);
  }
  const finished = await prisma.eventLocationPoll.findFirst({
    where: { eventId, status: EventPollStatus.Finished },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  return finished ? loadPollDto(finished.id, viewer) : null;
}

export async function claimEventAttendee(input: {
  readonly eventId: string;
  readonly guestUserId: string;
  readonly attendeeId: string;
  readonly name: string;
}): Promise<{ readonly claimedAttendeeId: string; readonly name: string }> {
  const attendee = await prisma.eventAttendee.findFirst({
    where: { id: input.attendeeId, eventId: input.eventId },
    include: { counterparty: { select: { name: true } } },
  });
  if (!attendee) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Attendee not found");
  }

  const taken = await prisma.eventGuestPresence.findFirst({
    where: {
      eventId: input.eventId,
      attendeeId: input.attendeeId,
      NOT: { guestUserId: input.guestUserId },
    },
    select: { id: true },
  });
  if (taken) {
    throw new AppServiceError(
      ApiErrorCode.Conflict,
      "This person is already claimed",
    );
  }

  const guest = await renameGuestUser({
    guestUserId: input.guestUserId,
    name: input.name,
  });

  await prisma.eventGuestPresence.upsert({
    where: {
      eventId_guestUserId: {
        eventId: input.eventId,
        guestUserId: input.guestUserId,
      },
    },
    create: {
      eventId: input.eventId,
      guestUserId: input.guestUserId,
      attendeeId: input.attendeeId,
    },
    update: { attendeeId: input.attendeeId, lastSeenAt: new Date() },
  });

  return { claimedAttendeeId: input.attendeeId, name: guest.name };
}

export async function readClaimedAttendeeId(
  eventId: string,
  guestUserId: string | null,
): Promise<string | null> {
  if (!guestUserId) {
    return null;
  }
  const presence = await prisma.eventGuestPresence.findUnique({
    where: {
      eventId_guestUserId: { eventId, guestUserId },
    },
    select: { attendeeId: true },
  });
  return presence?.attendeeId ?? null;
}

async function maybeAutoResolveExpired(
  pollId: string,
  eventId: string,
  viewer: PollAuthor,
): Promise<EventLocationPollDto> {
  const poll = await prisma.eventLocationPoll.findUnique({
    where: { id: pollId },
    include: {
      options: { select: { id: true } },
      votes: { select: { optionId: true } },
    },
  });
  if (!poll || poll.status !== EventPollStatus.Open || !poll.endsAt) {
    return loadPollDto(pollId, viewer);
  }
  if (poll.endsAt.getTime() > Date.now()) {
    return loadPollDto(pollId, viewer);
  }

  const resolution = resolvePollWinner(
    poll.options.map((option) => option.id),
    poll.votes,
  );
  if (resolution.kind === "unique") {
    const finished = await finishLocationPoll({
      eventId,
      pollId,
      chosenOptionId: resolution.optionId,
    });
    return finished.poll;
  }

  const dto = await loadPollDto(pollId, viewer);
  return { ...dto, needsOwnerPick: resolution.kind === "tie" };
}

async function loadPollDto(
  pollId: string,
  viewer: PollAuthor,
): Promise<EventLocationPollDto> {
  const poll = await prisma.eventLocationPoll.findUniqueOrThrow({
    where: { id: pollId },
    include: {
      options: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          authorGuest: { select: { name: true } },
          votes: {
            include: {
              voterGuest: { select: { id: true, name: true } },
            },
          },
        },
      },
      votes: {
        include: {
          voterGuest: { select: { id: true, name: true } },
        },
      },
      event: {
        select: {
          userId: true,
          ownerDisplayName: true,
          user: { select: { name: true } },
        },
      },
    },
  });

  const totalVotes = poll.votes.length;
  const counts = tallyVotesByOption(poll.votes);
  const expired =
    poll.status === EventPollStatus.Open &&
    poll.endsAt != null &&
    poll.endsAt.getTime() <= Date.now();

  let needsOwnerPick = false;
  if (expired && poll.status === EventPollStatus.Open) {
    const resolution = resolvePollWinner(
      poll.options.map((option) => option.id),
      poll.votes,
    );
    needsOwnerPick = resolution.kind === "tie";
  }

  const options: EventLocationPollOptionDto[] = poll.options.map((option) => {
    const voteCount = counts.get(option.id) ?? 0;
    return {
      id: option.id,
      title: option.title,
      link: option.link,
      address: option.address,
      latitude: toNumberOrNull(option.latitude),
      longitude: toNumberOrNull(option.longitude),
      imageUrl: option.imageUrl,
      sortOrder: option.sortOrder,
      voteCount,
      percent: votePercent(voteCount, totalVotes),
      authorGuestId: option.authorGuestId,
      authorUserId: option.authorUserId,
      authorName:
        option.authorGuest?.name ??
        (option.authorUserId === poll.event.userId
          ? poll.event.ownerDisplayName ?? poll.event.user.name
          : null),
    };
  });

  const voters = buildVoterSummaries(poll);
  const viewerVoteOptionIds = poll.votes
    .filter((vote) => isViewerVote(vote, viewer))
    .map((vote) => vote.optionId);

  return {
    id: poll.id,
    eventId: poll.eventId,
    title: poll.title,
    selectionMode: poll.selectionMode,
    endsAt: poll.endsAt?.toISOString() ?? null,
    status: poll.status,
    finishedOptionId: poll.finishedOptionId,
    needsOwnerPick,
    totalVotes,
    options,
    voters,
    viewerVoteOptionIds,
    createdAt: poll.createdAt.toISOString(),
  };
}

function buildVoterSummaries(poll: {
  readonly event: {
    readonly userId: string;
    readonly ownerDisplayName: string | null;
    readonly user: { readonly name: string };
  };
  readonly votes: readonly {
    readonly optionId: string;
    readonly voterUserId: string | null;
    readonly voterGuestId: string | null;
    readonly voterGuest: { readonly id: string; readonly name: string } | null;
  }[];
}): EventLocationPollVoterDto[] {
  const byKey = new Map<string, EventLocationPollVoterDto>();
  for (const vote of poll.votes) {
    const key = vote.voterUserId
      ? `user:${vote.voterUserId}`
      : `guest:${vote.voterGuestId}`;
    const existing = byKey.get(key);
    if (existing) {
      byKey.set(key, {
        ...existing,
        optionIds: [...existing.optionIds, vote.optionId],
      });
      continue;
    }
    const name = vote.voterGuest?.name
      ?? (vote.voterUserId
        ? poll.event.ownerDisplayName ?? poll.event.user.name
        : "Guest");
    byKey.set(key, {
      key,
      name,
      optionIds: [vote.optionId],
      isOwner: vote.voterUserId === poll.event.userId,
    });
  }
  return [...byKey.values()];
}

async function requireOpenPoll(eventId: string, pollId: string) {
  const poll = await prisma.eventLocationPoll.findFirst({
    where: { id: pollId, eventId },
  });
  if (!poll) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Poll not found");
  }
  if (poll.status !== EventPollStatus.Open) {
    throw new AppServiceError(ApiErrorCode.Validation, "Poll is finished");
  }
  return poll;
}

/** Owner may still manage options after finish; guests only while open. */
async function requireMutablePoll(
  eventId: string,
  pollId: string,
  viewer: EventViewer,
) {
  const poll = await prisma.eventLocationPoll.findFirst({
    where: { id: pollId, eventId },
  });
  if (!poll) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Poll not found");
  }
  if (
    poll.status !== EventPollStatus.Open &&
    viewer.role !== EventAuthorRole.Owner
  ) {
    throw new AppServiceError(ApiErrorCode.Validation, "Poll is finished");
  }
  return poll;
}

function assertVotingOpen(endsAt: Date | null): void {
  if (endsAt && endsAt.getTime() <= Date.now()) {
    throw new AppServiceError(ApiErrorCode.Validation, "Voting has ended");
  }
}

function assertCanMutateOption(
  viewer: EventViewer,
  option: { readonly authorUserId: string | null; readonly authorGuestId: string | null },
): void {
  if (viewer.role === EventAuthorRole.Owner) {
    return;
  }
  if (
    viewer.guestUserId &&
    option.authorGuestId &&
    viewer.guestUserId === option.authorGuestId
  ) {
    return;
  }
  throw new AppServiceError(
    ApiErrorCode.Forbidden,
    "You can only change options you added",
  );
}

async function prepareOptionData(
  option: PollOptionInput,
  sortOrder: number,
  author: PollAuthor,
) {
  return {
    title: option.title.trim(),
    link: emptyToNull(option.link),
    address: emptyToNull(option.address),
    latitude: option.latitude ?? null,
    longitude: option.longitude ?? null,
    imageUrl: await imageForLink(option.link),
    authorUserId: author.userId,
    authorGuestId: author.guestUserId,
    sortOrder,
  };
}

async function imageForLink(link: string | null | undefined): Promise<string | null> {
  const url = emptyToNull(link);
  if (!url) {
    return null;
  }
  return fetchLinkPreviewImage(url);
}

function voterFilter(viewer: EventViewer) {
  if (viewer.userId) {
    return { voterUserId: viewer.userId };
  }
  if (viewer.guestUserId) {
    return { voterGuestId: viewer.guestUserId };
  }
  throw new AppServiceError(ApiErrorCode.Unauthorized, "Sign in or join as guest");
}

function isViewerVote(
  vote: { readonly voterUserId: string | null; readonly voterGuestId: string | null },
  viewer: PollAuthor,
): boolean {
  if (viewer.userId && vote.voterUserId === viewer.userId) {
    return true;
  }
  return Boolean(viewer.guestUserId && vote.voterGuestId === viewer.guestUserId);
}

function viewerAsAuthor(viewer: EventViewer): PollAuthor {
  return { userId: viewer.userId, guestUserId: viewer.guestUserId };
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNumberOrNull(value: { toNumber?: () => number } | number | null): number | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "number") {
    return value;
  }
  return value.toNumber?.() ?? Number(value);
}
