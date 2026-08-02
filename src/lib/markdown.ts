import DOMPurify from "isomorphic-dompurify";
import { marked, Renderer, type Tokens } from "marked";

marked.setOptions({
  gfm: true,
  breaks: true,
});

export type RenderMarkdownOptions = {
  readonly locale?: string;
};

const PAYMENT_LANGS = new Set(["payment", "payment-details"]);

/** Turns markdown into sanitized HTML safe for dangerouslySetInnerHTML. */
export function renderMarkdown(
  source: string | null | undefined,
  options: RenderMarkdownOptions = {},
): string {
  const renderer = new Renderer();
  const defaultCode = renderer.code.bind(renderer);
  renderer.code = (token: Tokens.Code) => {
    const lang = (token.lang ?? "").trim().toLowerCase().split(/\s+/)[0] ?? "";
    if (PAYMENT_LANGS.has(lang)) {
      return renderPaymentDetailsBlock(token.text, options.locale);
    }
    return defaultCode(token);
  };

  const html = marked.parse(source ?? "", { async: false, renderer });
  return DOMPurify.sanitize(typeof html === "string" ? html : "", {
    ADD_TAGS: ["aside"],
    ADD_ATTR: ["class"],
  });
}

function renderPaymentDetailsBlock(body: string, locale?: string): string {
  const content = body.replace(/^\n+|\n+$/g, "");
  const innerHtml = marked.parse(content || " ", { async: false });
  const safeInner = typeof innerHtml === "string" ? innerHtml : "";
  const label = paymentDetailsLabel(locale);
  return [
    `<aside class="event-payment-details">`,
    `<p class="event-payment-details__label">${escapeHtml(label)}</p>`,
    `<div class="event-payment-details__body">${safeInner}</div>`,
    `</aside>\n`,
  ].join("");
}

function paymentDetailsLabel(locale?: string): string {
  if (locale?.startsWith("ru")) {
    return "Реквизиты для оплаты";
  }
  return "Payment details";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
