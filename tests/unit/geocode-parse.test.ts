import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parsePhotonResponse,
  toPhotonLanguage,
  toPhotonSearchLanguage,
} from "../../src/server/services/geocode-service";

/** Captured from photon.komoot.io for "Ижевск, 9-ая подлесная 11 к3". */
const buildingResponse = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        osm_type: "W",
        housenumber: "11 к3",
        street: "9-я Подлесная улица",
        locality: "4-й мкр.",
        district: "городок Металлургов",
        city: "Ижевск",
        state: "Удмуртия",
        country: "Россия",
        postcode: "426001",
      },
      geometry: { type: "Point", coordinates: [53.1977784, 56.8734868] },
    },
  ],
};

describe("parsePhotonResponse", () => {
  it("builds a street-first display name from the address parts", () => {
    const places = parsePhotonResponse(buildingResponse);

    assert.equal(places.length, 1);
    assert.equal(
      places[0]!.displayName,
      "9-я Подлесная улица, 11 к3, городок Металлургов, Ижевск, Удмуртия, Россия",
    );
  });

  it("reads GeoJSON coordinates as longitude then latitude", () => {
    const [place] = parsePhotonResponse(buildingResponse);

    assert.equal(place!.latitude, 56.8734868);
    assert.equal(place!.longitude, 53.1977784);
  });

  it("falls back to the place name when there is no street", () => {
    const places = parsePhotonResponse({
      features: [
        {
          properties: { name: "Красная площадь", city: "Москва" },
          geometry: { coordinates: [37.6208, 55.7539] },
        },
      ],
    });

    assert.equal(places[0]!.displayName, "Красная площадь, Москва");
  });

  it("skips features without usable coordinates", () => {
    const places = parsePhotonResponse({
      features: [
        { properties: { name: "Nowhere" }, geometry: { coordinates: [] } },
        { properties: { name: "Broken" } },
      ],
    });

    assert.deepEqual(places, []);
  });

  it("returns nothing for an empty result set", () => {
    assert.deepEqual(parsePhotonResponse({ features: [] }), []);
  });
});

describe("toPhotonLanguage", () => {
  it("asks for English names in the English UI", () => {
    assert.equal(toPhotonLanguage("en"), "en");
  });

  it("keeps local spelling for locales Photon cannot translate", () => {
    assert.equal(toPhotonLanguage("ru"), "default");
  });
});

describe("toPhotonSearchLanguage", () => {
  it("keeps local spelling when the query itself is Cyrillic", () => {
    assert.equal(
      toPhotonSearchLanguage("Ижевск, 9-ая подлесная", "en"),
      "default",
    );
  });

  it("follows the UI locale for Latin queries", () => {
    assert.equal(toPhotonSearchLanguage("Moscow Red Square", "en"), "en");
    assert.equal(toPhotonSearchLanguage("Moscow Red Square", "ru"), "default");
  });
});
