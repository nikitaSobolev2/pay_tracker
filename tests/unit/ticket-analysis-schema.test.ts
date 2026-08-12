import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildFallbackTitle,
  parseTicketAnalysisResponse,
} from "@/server/services/ticket-analysis-schema";

const SMARTAVIA_BOOKING = {
  tickets: [
    {
      title: "IJK → LED · 5N 590",
      origin: "IJK",
      destination: "LED",
      departs_at: "2026-08-30T17:40:00",
      arrives_at: "2026-08-30T19:10:00",
      ticket_number: "3162445299002",
      flight_number: "5N 590",
      booking_code: "G1VP3R",
    },
    {
      title: "LED → IJK · 5N 589",
      origin: "LED",
      destination: "IJK",
      departs_at: "2026-09-06T14:20:00",
      arrives_at: "2026-09-06T15:50:00",
      ticket_number: "3162445299002",
      flight_number: "5N 589",
      booking_code: "G1VP3R",
    },
  ],
};

describe("parseTicketAnalysisResponse", () => {
  it("parses a Smartavia round trip into two ticket segments", () => {
    const tickets = parseTicketAnalysisResponse(
      JSON.stringify(SMARTAVIA_BOOKING),
    );

    assert.equal(tickets.length, 2);
    assert.equal(tickets[0]?.flightNumber, "5N 590");
    assert.equal(tickets[0]?.origin, "IJK");
    assert.equal(tickets[0]?.destination, "LED");
    assert.equal(tickets[0]?.ticketNumber, "3162445299002");
    assert.equal(tickets[0]?.bookingCode, "G1VP3R");
    assert.equal(tickets[1]?.flightNumber, "5N 589");
    assert.equal(tickets[1]?.origin, "LED");
    assert.equal(tickets[1]?.destination, "IJK");
    assert.equal(tickets[1]?.bookingCode, "G1VP3R");
  });

  it("builds a fallback title when the model omits title", () => {
    const tickets = parseTicketAnalysisResponse(
      JSON.stringify({
        tickets: [
          {
            title: null,
            origin: "IJK",
            destination: "LED",
            departs_at: null,
            arrives_at: null,
            ticket_number: null,
            flight_number: "5N 590",
            booking_code: "G1VP3R",
          },
        ],
      }),
    );

    assert.equal(tickets[0]?.title, "IJK → LED · 5N 590");
    assert.equal(buildFallbackTitle("IJK", "LED", "5N 590"), "IJK → LED · 5N 590");
  });
});
