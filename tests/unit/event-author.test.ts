import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveAuthor, resolveOwnerName } from "../../src/lib/event-author";
import { EventAuthorRole } from "../../src/types/enums";

describe("resolveAuthor", () => {
  it("prefers the event-specific owner name over the account name", () => {
    const author = resolveAuthor({
      ownerDisplayName: "Birthday host",
      ownerName: "Nikita",
      authorUserId: "user-1",
      guestName: null,
    });

    assert.deepEqual(author, {
      role: EventAuthorRole.Owner,
      name: "Birthday host",
    });
  });

  it("falls back to the account name when the owner name is blank", () => {
    const author = resolveAuthor({
      ownerDisplayName: "   ",
      ownerName: "Nikita",
      authorUserId: "user-1",
      guestName: null,
    });

    assert.equal(author.name, "Nikita");
  });

  it("names an unauthenticated author by their guest name", () => {
    const author = resolveAuthor({
      ownerDisplayName: null,
      ownerName: "Nikita",
      authorUserId: null,
      guestName: "Clara",
    });

    assert.deepEqual(author, { role: EventAuthorRole.Guest, name: "Clara" });
  });

  it("labels analyzer output as the AI author instead of a guest", () => {
    const author = resolveAuthor({
      ownerDisplayName: null,
      ownerName: "Nikita",
      authorUserId: null,
      guestName: null,
      isAiGenerated: true,
    });

    assert.deepEqual(author, { role: EventAuthorRole.Ai, name: "AI" });
  });

  it("uses a placeholder for a guest who never picked a name", () => {
    const author = resolveAuthor({
      ownerDisplayName: null,
      ownerName: "Nikita",
      authorUserId: null,
      guestName: null,
    });

    assert.equal(author.name, "Guest");
  });
});

describe("resolveOwnerName", () => {
  it("returns the account name when no event name is set", () => {
    assert.equal(resolveOwnerName(null, "Nikita"), "Nikita");
  });
});
