import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { renderMarkdown } from "../../src/lib/markdown";

describe("renderMarkdown", () => {
  it("turns markdown into HTML", () => {
    const html = renderMarkdown("**bold** and a [link](https://example.com)");
    assert.match(html, /<strong>bold<\/strong>/);
    assert.match(html, /href="https:\/\/example.com"/);
  });

  it("strips script tags from the rendered HTML", () => {
    const html = renderMarkdown(
      'Hello <script>alert("xss")</script> world',
    );
    assert.doesNotMatch(html, /<script/i);
    assert.match(html, /Hello/);
    assert.match(html, /world/);
  });

  it("renders a payment fence as a styled payment-details block", () => {
    const html = renderMarkdown(
      ["```payment", "Card: **1234**", "Phone: +1 555", "```"].join("\n"),
      { locale: "en" },
    );
    assert.match(html, /class="event-payment-details"/);
    assert.match(html, /Payment details/);
    assert.match(html, /<strong>1234<\/strong>/);
    assert.match(html, /\+1 555/);
    assert.doesNotMatch(html, /<pre>/);
  });

  it("localizes the payment-details label for Russian", () => {
    const html = renderMarkdown("```payment\nСбер\n```", { locale: "ru" });
    assert.match(html, /Реквизиты для оплаты/);
  });
});
