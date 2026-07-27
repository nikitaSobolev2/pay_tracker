export type UserAgentLabels = {
  readonly unknownDevice: string;
  readonly unknownBrowser: string;
  readonly unknownOs: string;
};

/** Human-readable "Browser · OS" from a raw user-agent string. */
export function describeUserAgent(
  userAgent: string | null | undefined,
  labels: UserAgentLabels,
): string {
  if (!userAgent) {
    return labels.unknownDevice;
  }

  const browser =
    matchFirst(userAgent, [
      [/Edg\/[\d.]+/i, "Edge"],
      [/Chrome\/[\d.]+/i, "Chrome"],
      [/Firefox\/[\d.]+/i, "Firefox"],
      [/Safari\/[\d.]+/i, "Safari"],
    ]) ?? labels.unknownBrowser;

  const os =
    matchFirst(userAgent, [
      [/Windows NT/i, "Windows"],
      [/Mac OS X/i, "macOS"],
      [/Android/i, "Android"],
      [/iPhone|iPad/i, "iOS"],
      [/Linux/i, "Linux"],
    ]) ?? labels.unknownOs;

  return `${browser} · ${os}`;
}

function matchFirst(
  value: string,
  rules: ReadonlyArray<readonly [RegExp, string]>,
): string | null {
  for (const [pattern, label] of rules) {
    if (pattern.test(value)) {
      return label;
    }
  }
  return null;
}
