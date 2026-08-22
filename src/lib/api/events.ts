import { apiFetch, buildQuery } from "@/lib/api/client";
import type { EventChatMessageDto } from "@/server/services/event-chat-service";
import type {
  EventAiReportDto,
  EventAttendeeDto,
  EventDetailResponse,
  EventLinkDto,
  EventListItemDto,
  EventSettlementResponse,
  UpcomingEventChipDto,
} from "@/server/services/event-service.types";
import type {
  EventLocationPollDto,
  FinishPollResult,
} from "@/server/services/event-location-poll-service.types";
import type { EventLiveDto } from "@/server/services/event-live-service";
import type { EventThreadDto } from "@/server/services/event-thread-service";
import type {
  EventAttendanceStatus,
  EventGuestPermission,
  EventLinkType,
  EventPhase,
  EventPollSelectionMode,
  EventPublicity,
  EventSpendingCategory,
  EventSpendingField,
} from "@/types/enums";

export type EventLocationFields = {
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type CreateEventBody = {
  title: string;
  description?: string | null;
  occursAt: string;
  endsAt?: string | null;
  imageUrl?: string | null;
  publicity: EventPublicity;
  guestPermission: EventGuestPermission;
  counterpartyIds: string[];
} & EventLocationFields;

export type UpdateEventBody = Partial<
  Omit<CreateEventBody, "counterpartyIds">
> & {
  ownerDisplayName?: string | null;
  manualPerPersonAmount?: string | null;
  phaseOverride?: EventPhase | null;
  clearPhaseOverride?: boolean;
};

export type SpendingBody = {
  title: string;
  category: EventSpendingCategory;
  amount: string;
  amountUnit: string;
  price: string;
  note?: string | null;
};

export function listEvents() {
  return apiFetch<{ events: EventListItemDto[] }>("/api/events");
}

export function fetchUpcomingEvent() {
  return apiFetch<{ event: UpcomingEventChipDto | null }>("/api/events/upcoming");
}

export function createEvent(body: CreateEventBody) {
  return apiFetch<{ eventId: string }>("/api/events", {
    method: "POST",
    body,
  });
}

export function fetchEvent(eventId: string) {
  return apiFetch<EventDetailResponse>(`/api/events/${eventId}`);
}

export function updateEvent(eventId: string, body: UpdateEventBody) {
  return apiFetch<EventDetailResponse>(`/api/events/${eventId}`, {
    method: "PATCH",
    body,
  });
}

export function deleteEvent(eventId: string) {
  return apiFetch<{ ok: true }>(`/api/events/${eventId}`, { method: "DELETE" });
}

export function fetchEventSettlement(eventId: string) {
  return apiFetch<EventSettlementResponse>(`/api/events/${eventId}/summary`);
}

export function addEventAttendee(
  eventId: string,
  body: { counterpartyId?: string; name?: string },
) {
  return apiFetch<{ attendee: EventAttendeeDto }>(
    `/api/events/${eventId}/attendees`,
    { method: "POST", body },
  );
}

export function updateEventAttendee(
  eventId: string,
  attendeeId: string,
  status: EventAttendanceStatus,
) {
  return apiFetch<{ ok: true }>(
    `/api/events/${eventId}/attendees/${attendeeId}`,
    { method: "PATCH", body: { status } },
  );
}

export function removeEventAttendee(eventId: string, attendeeId: string) {
  return apiFetch<{ ok: true }>(
    `/api/events/${eventId}/attendees/${attendeeId}`,
    { method: "DELETE" },
  );
}

export function createEventLink(
  eventId: string,
  body: { type: EventLinkType; title: string; url: string },
) {
  return apiFetch<{ link: EventLinkDto }>(`/api/events/${eventId}/links`, {
    method: "POST",
    body,
  });
}

export function updateEventLink(
  eventId: string,
  linkId: string,
  body: { type?: EventLinkType; title?: string; url?: string },
) {
  return apiFetch<{ link: EventLinkDto }>(
    `/api/events/${eventId}/links/${linkId}`,
    { method: "PATCH", body },
  );
}

export function deleteEventLink(eventId: string, linkId: string) {
  return apiFetch<{ ok: true }>(`/api/events/${eventId}/links/${linkId}`, {
    method: "DELETE",
  });
}

export function createEventSpending(eventId: string, body: SpendingBody) {
  return apiFetch<{ spendingId: string }>(`/api/events/${eventId}/spendings`, {
    method: "POST",
    body,
  });
}

export function updateEventSpending(
  eventId: string,
  spendingId: string,
  body: Partial<SpendingBody>,
) {
  return apiFetch<{ ok: true }>(
    `/api/events/${eventId}/spendings/${spendingId}`,
    { method: "PATCH", body },
  );
}

export function deleteEventSpending(eventId: string, spendingId: string) {
  return apiFetch<{ ok: true }>(
    `/api/events/${eventId}/spendings/${spendingId}`,
    { method: "DELETE" },
  );
}

export function createEventPayment(
  eventId: string,
  body: { attendeeId: string; amount: string },
) {
  return apiFetch<EventSettlementResponse>(`/api/events/${eventId}/payments`, {
    method: "POST",
    body,
  });
}

export function updateEventPayment(
  eventId: string,
  paymentId: string,
  amount: string,
) {
  return apiFetch<EventSettlementResponse>(
    `/api/events/${eventId}/payments/${paymentId}`,
    { method: "PATCH", body: { amount } },
  );
}

export function deleteEventPayment(eventId: string, paymentId: string) {
  return apiFetch<EventSettlementResponse>(
    `/api/events/${eventId}/payments/${paymentId}`,
    { method: "DELETE" },
  );
}

export function listEventThreads(eventId: string, spendingId?: string) {
  return apiFetch<{ threads: EventThreadDto[] }>(
    `/api/events/${eventId}/threads${buildQuery({ spendingId })}`,
  );
}

export function createEventThread(
  eventId: string,
  body: {
    spendingId: string;
    body?: string;
    imageUrl?: string | null;
  },
) {
  return apiFetch<{ threads: EventThreadDto[] }>(
    `/api/events/${eventId}/threads`,
    { method: "POST", body },
  );
}

export function setEventThreadResolved(
  eventId: string,
  threadId: string,
  resolved: boolean,
) {
  return apiFetch<{ ok: true }>(`/api/events/${eventId}/threads/${threadId}`, {
    method: "PATCH",
    body: { resolved },
  });
}

export function createEventComment(
  eventId: string,
  threadId: string,
  body: string | { body?: string; imageUrl?: string | null },
) {
  const payload = typeof body === "string" ? { body } : body;
  return apiFetch<{ commentId: string }>(
    `/api/events/${eventId}/threads/${threadId}/comments`,
    { method: "POST", body: payload },
  );
}

export function deleteEventComment(
  eventId: string,
  threadId: string,
  commentId: string,
) {
  return apiFetch<{ ok: true }>(
    `/api/events/${eventId}/threads/${threadId}/comments/${commentId}`,
    { method: "DELETE" },
  );
}

export function analyzeEvent(
  eventId: string,
  input: {
    readonly contextMessage?: string | null;
    readonly responseLocale: string;
  },
) {
  return apiFetch<{ report: EventAiReportDto }>(
    `/api/events/${eventId}/analyze`,
    {
      method: "POST",
      body: {
        contextMessage: input.contextMessage?.trim() || null,
        responseLocale: input.responseLocale,
      },
    },
  );
}

export function applyEventSuggestion(
  eventId: string,
  threadId: string,
  commentId: string,
  field: EventSpendingField,
) {
  return apiFetch<{ ok: true }>(
    `/api/events/${eventId}/threads/${threadId}/comments/${commentId}/apply`,
    { method: "POST", body: { field } },
  );
}

export function applyEventMissingItemSuggestion(
  eventId: string,
  suggestionId: string,
) {
  return apiFetch<{ spendingId: string }>(
    `/api/events/${eventId}/ai-suggestions/${suggestionId}/apply`,
    { method: "POST" },
  );
}

export function fetchEventChat(eventId: string, afterId?: string | null) {
  return apiFetch<{ messages: EventChatMessageDto[] }>(
    `/api/events/${eventId}/chat${buildQuery({ afterId })}`,
  );
}

export function postEventChatMessage(
  eventId: string,
  body: string | { body?: string; imageUrl?: string | null },
) {
  const payload = typeof body === "string" ? { body } : body;
  return apiFetch<{ messageId: string }>(`/api/events/${eventId}/chat`, {
    method: "POST",
    body: payload,
  });
}

export function deleteEventChatMessage(eventId: string, messageId: string) {
  return apiFetch<{ ok: true }>(`/api/events/${eventId}/chat/${messageId}`, {
    method: "DELETE",
  });
}

export function pollEventLive(eventId: string, chatAfterId: string | null) {
  return apiFetch<EventLiveDto>(`/api/events/${eventId}/live`, {
    method: "POST",
    body: { chatAfterId },
  });
}

export function uploadEventCover(file: File, eventId: string | null) {
  const formData = new FormData();
  formData.append("file", file);
  if (eventId) {
    formData.append("eventId", eventId);
  }
  return apiFetch<{ url: string }>("/api/uploads/event-cover", {
    method: "POST",
    formData,
  });
}

export function uploadEventAttachment(file: File, eventId: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("eventId", eventId);
  return apiFetch<{ url: string }>("/api/uploads/event-attachment", {
    method: "POST",
    formData,
  });
}

export function ensureGuest() {
  return apiFetch<{ guest: { id: string; name: string } }>("/api/guest", {
    method: "POST",
  });
}

export function renameGuest(name: string) {
  return apiFetch<{ guest: { id: string; name: string } }>("/api/guest", {
    method: "PATCH",
    body: { name },
  });
}

export type PollOptionBody = {
  id?: string;
  title: string;
  link?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export function createEventLocationPoll(
  eventId: string,
  body: {
    title: string;
    selectionMode: EventPollSelectionMode;
    endsAt?: string | null;
    options: PollOptionBody[];
  },
) {
  return apiFetch<{ poll: EventLocationPollDto }>(
    `/api/events/${eventId}/location-poll`,
    { method: "POST", body },
  );
}

export function updateEventLocationPoll(
  eventId: string,
  body: {
    pollId: string;
    title: string;
    selectionMode: EventPollSelectionMode;
    endsAt?: string | null;
    options: PollOptionBody[];
  },
) {
  return apiFetch<{ poll: EventLocationPollDto }>(
    `/api/events/${eventId}/location-poll`,
    { method: "PATCH", body },
  );
}

export function deleteEventLocationPoll(
  eventId: string,
  body: { pollId: string },
) {
  return apiFetch<{ ok: true }>(`/api/events/${eventId}/location-poll`, {
    method: "DELETE",
    body,
  });
}

export function addEventLocationPollOption(
  eventId: string,
  body: { pollId: string; option: PollOptionBody },
) {
  return apiFetch<{ poll: EventLocationPollDto }>(
    `/api/events/${eventId}/location-poll/options`,
    { method: "POST", body },
  );
}

export function updateEventLocationPollOption(
  eventId: string,
  optionId: string,
  body: { pollId: string; option: PollOptionBody },
) {
  return apiFetch<{ poll: EventLocationPollDto }>(
    `/api/events/${eventId}/location-poll/options/${optionId}`,
    { method: "PATCH", body },
  );
}

export function deleteEventLocationPollOption(
  eventId: string,
  optionId: string,
  pollId: string,
) {
  return apiFetch<{ poll: EventLocationPollDto }>(
    `/api/events/${eventId}/location-poll/options/${optionId}?pollId=${encodeURIComponent(pollId)}`,
    { method: "DELETE" },
  );
}

export function setEventLocationPollVotes(
  eventId: string,
  body: { pollId: string; optionIds: string[] },
) {
  return apiFetch<{ poll: EventLocationPollDto }>(
    `/api/events/${eventId}/location-poll/votes`,
    { method: "PUT", body },
  );
}

export function finishEventLocationPoll(
  eventId: string,
  body: { pollId: string; optionId?: string },
) {
  return apiFetch<FinishPollResult>(
    `/api/events/${eventId}/location-poll/finish`,
    { method: "POST", body },
  );
}

export function claimEventAttendee(
  eventId: string,
  body: { attendeeId: string; name: string },
) {
  return apiFetch<{ claimedAttendeeId: string; name: string }>(
    `/api/events/${eventId}/claim-attendee`,
    { method: "POST", body },
  );
}
