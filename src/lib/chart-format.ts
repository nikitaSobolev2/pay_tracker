/**
 * Formats a timeline bucket key into a short, localized axis label.
 * Bucket keys come from the stats service in one of these shapes:
 *   - "yyyy-MM-dd HH:00" (hourly)  → "14:00"
 *   - "yyyy-MM-dd"       (daily)   → localized "MMM d"
 *   - "yyyy-MM"          (monthly) → localized "MMM"
 *   - "yyyy"             (yearly)  → "yyyy"
 */
export function formatBucketLabel(bucket: string, locale: string): string {
  const hourMatch = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2})/.exec(bucket);
  if (hourMatch) {
    return `${hourMatch[4]}:00`;
  }

  const dayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(bucket);
  if (dayMatch) {
    const date = utcDate(dayMatch[1]!, dayMatch[2]!, dayMatch[3]!);
    return new Intl.DateTimeFormat(locale, {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
    }).format(date);
  }

  const monthMatch = /^(\d{4})-(\d{2})$/.exec(bucket);
  if (monthMatch) {
    const date = utcDate(monthMatch[1]!, monthMatch[2]!, "01");
    return new Intl.DateTimeFormat(locale, {
      timeZone: "UTC",
      month: "short",
      year: "2-digit",
    }).format(date);
  }

  return bucket;
}

function utcDate(year: string, month: string, day: string): Date {
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}
