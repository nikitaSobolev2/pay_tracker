import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mergeMessages } from "../../src/features/events/use-event-live";
import type { EventChatMessageDto } from "../../src/server/services/event-chat-service";
import { EventAuthorRole } from "../../src/types/enums";

function message(id: string): EventChatMessageDto {
  return {
    id,
    body: `message ${id}`,
    imageUrl: null,
    author: { role: EventAuthorRole.Guest, name: "Clara" },
    createdAt: "2026-08-02T12:00:00.000Z",
    isMine: false,
    canDelete: false,
  };
}

describe("mergeMessages", () => {
  it("appends messages that arrived since the last poll", () => {
    const merged = mergeMessages([message("1")], [message("2")]);

    assert.deepEqual(
      merged.map((item) => item.id),
      ["1", "2"],
    );
  });

  it("keeps the same list when the poll returns nothing", () => {
    const current = [message("1")];

    assert.equal(mergeMessages(current, []), current);
  });

  it("ignores messages already rendered so a retry cannot duplicate them", () => {
    const current = [message("1"), message("2")];

    assert.equal(mergeMessages(current, [message("2")]), current);
  });

  it("adds only the unseen part of an overlapping batch", () => {
    const merged = mergeMessages(
      [message("1")],
      [message("1"), message("2"), message("3")],
    );

    assert.deepEqual(
      merged.map((item) => item.id),
      ["1", "2", "3"],
    );
  });
});
