import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseGeocoderResponse,
  parseSuggestResponse,
  toYandexLanguage,
} from "../../src/server/services/geocode-service";

const suggestResponse = {
  results: [
    {
      title: { text: "9-я Подлесная улица, 11к3" },
      subtitle: { text: "Ижевск" },
      address: {
        formatted_address: "Россия, Ижевск, 9-я Подлесная улица, 11к3",
      },
      uri: "ymapsbm1://geo?data=test",
    },
  ],
};

const geocoderResponse = {
  response: {
    GeoObjectCollection: {
      featureMember: [
        {
          GeoObject: {
            name: "11к3",
            description: "9-я Подлесная улица, Ижевск",
            Point: { pos: "53.1977784 56.8734868" },
            metaDataProperty: {
              GeocoderMetaData: {
                text: "Россия, Ижевск, 9-я Подлесная улица, 11к3",
                Address: {
                  formatted: "Россия, Ижевск, 9-я Подлесная улица, 11к3",
                },
              },
            },
          },
        },
      ],
    },
  },
};

describe("parseSuggestResponse", () => {
  it("prefers formatted address and keeps uri for geocoder resolve", () => {
    const items = parseSuggestResponse(suggestResponse);

    assert.equal(items.length, 1);
    assert.equal(
      items[0]!.displayName,
      "Россия, Ижевск, 9-я Подлесная улица, 11к3",
    );
    assert.equal(items[0]!.uri, "ymapsbm1://geo?data=test");
  });

  it("falls back to title when address is missing", () => {
    const items = parseSuggestResponse({
      results: [{ title: { text: "Красная площадь" } }],
    });
    assert.equal(items[0]!.displayName, "Красная площадь");
    assert.equal(items[0]!.uri, null);
  });

  it("returns nothing for an empty result set", () => {
    assert.deepEqual(parseSuggestResponse({ results: [] }), []);
  });
});

describe("parseGeocoderResponse", () => {
  it("reads lon lat from Point.pos and formatted address", () => {
    const places = parseGeocoderResponse(geocoderResponse);

    assert.equal(places.length, 1);
    assert.equal(
      places[0]!.displayName,
      "Россия, Ижевск, 9-я Подлесная улица, 11к3",
    );
    assert.equal(places[0]!.latitude, 56.8734868);
    assert.equal(places[0]!.longitude, 53.1977784);
  });

  it("skips members without usable coordinates", () => {
    const places = parseGeocoderResponse({
      response: {
        GeoObjectCollection: {
          featureMember: [{ GeoObject: { name: "Broken", Point: {} } }],
        },
      },
    });
    assert.deepEqual(places, []);
  });
});

describe("toYandexLanguage", () => {
  it("maps UI locale to Yandex lang codes", () => {
    assert.equal(toYandexLanguage("en"), "en_US");
    assert.equal(toYandexLanguage("ru"), "ru_RU");
  });
});
