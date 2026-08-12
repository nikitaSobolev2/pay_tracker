import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatTicketDate,
  formatTicketTime,
  hasTicketItinerary,
  parseTicketPlace,
  ticketPassQrValue,
} from "@/features/travels/ticket-pass-format";

describe("parseTicketPlace", () => {
  it("treats a 3-letter Latin code as IATA", () => {
    assert.deepEqual(parseTicketPlace("ijk"), {
      code: "IJK",
      name: null,
    });
  });

  it("keeps a city name without inventing a code", () => {
    assert.deepEqual(parseTicketPlace("Сыктывкар"), {
      code: null,
      name: "Сыктывкар",
    });
  });

  it("splits a code in parentheses", () => {
    assert.deepEqual(parseTicketPlace("Syktyvkar (SCW)"), {
      code: "SCW",
      name: "Syktyvkar",
    });
  });

  it("splits a leading IATA prefix", () => {
    assert.deepEqual(parseTicketPlace("LED · Pulkovo"), {
      code: "LED",
      name: "Pulkovo",
    });
  });

  it("does not treat a city like New York as IATA", () => {
    assert.deepEqual(parseTicketPlace("New York"), {
      code: null,
      name: "New York",
    });
  });

  it("returns empty labels for blank input", () => {
    assert.deepEqual(parseTicketPlace("  "), { code: null, name: null });
    assert.deepEqual(parseTicketPlace(null), { code: null, name: null });
  });
});

describe("hasTicketItinerary", () => {
  it("is false when every flight field is empty", () => {
    assert.equal(
      hasTicketItinerary({
        origin: null,
        destination: null,
        departsAt: null,
        arrivesAt: null,
        ticketNumber: null,
        flightNumber: null,
        bookingCode: null,
        seat: null,
      }),
      false,
    );
  });

  it("is true when a route exists", () => {
    assert.equal(
      hasTicketItinerary({
        origin: "IJK",
        destination: "LED",
        departsAt: null,
        arrivesAt: null,
        ticketNumber: null,
        flightNumber: null,
        bookingCode: null,
        seat: null,
      }),
      true,
    );
  });

  it("is true when only a seat is present", () => {
    assert.equal(
      hasTicketItinerary({
        origin: null,
        destination: null,
        departsAt: null,
        arrivesAt: null,
        ticketNumber: null,
        flightNumber: null,
        bookingCode: null,
        seat: "14A",
      }),
      true,
    );
  });
});

describe("ticket datetime and QR", () => {
  it("formats date and time from an ISO local timestamp", () => {
    assert.match(formatTicketDate("2026-08-30T11:45:00", "en") ?? "", /30/);
    assert.match(formatTicketDate("2026-08-30T11:45:00", "en") ?? "", /Aug/i);
    assert.match(formatTicketTime("2026-08-30T11:45:00", "en") ?? "", /11:45/);
  });

  it("prefers booking code for the stub QR", () => {
    assert.equal(
      ticketPassQrValue({ bookingCode: "G1VP3R", ticketNumber: "3162" }),
      "G1VP3R",
    );
    assert.equal(
      ticketPassQrValue({ bookingCode: null, ticketNumber: "3162" }),
      "3162",
    );
  });
});
