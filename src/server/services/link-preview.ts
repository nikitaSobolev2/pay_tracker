/**
 * Extract Open Graph / Twitter image URL from HTML.
 * Fail soft — callers treat null as "no preview".
 */

const META_PATTERNS = [
  /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
  /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']image_src["']/i,
];

const BODY_CAP_BYTES = 512 * 1024;
const FETCH_TIMEOUT_MS = 5_000;

export function extractImageFromHtml(
  html: string,
  pageUrl: string,
): string | null {
  for (const pattern of META_PATTERNS) {
    const match = pattern.exec(html);
    const raw = match?.[1]?.trim();
    if (!raw) {
      continue;
    }
    const absolute = resolveAbsoluteUrl(raw, pageUrl);
    if (absolute) {
      return absolute;
    }
  }
  return null;
}

export function resolveAbsoluteUrl(
  candidate: string,
  pageUrl: string,
): string | null {
  try {
    const resolved = new URL(candidate, pageUrl);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return null;
    }
    return resolved.toString();
  } catch {
    return null;
  }
}

export async function fetchLinkPreviewImage(
  pageUrl: string,
): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(pageUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(parsed.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (compatible; PayTrackerBot/1.0; +https://paytracker.local)",
      },
    });
    if (!response.ok) {
      return null;
    }
    const buffer = await response.arrayBuffer();
    const slice = buffer.byteLength > BODY_CAP_BYTES
      ? buffer.slice(0, BODY_CAP_BYTES)
      : buffer;
    const html = new TextDecoder("utf-8", { fatal: false }).decode(slice);
    return extractImageFromHtml(html, response.url || parsed.toString());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
