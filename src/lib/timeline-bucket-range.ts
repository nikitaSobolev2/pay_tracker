import { endOfMonth, endOfYear, format, startOfMonth, startOfYear } from "date-fns";

/** Resolve a timeline bucket key to an absolute YYYY-MM-DD range. */
export function timelineBucketToDateRange(bucket: string): {
  startDate: string;
  endDate: string;
} | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(bucket)) {
    return { startDate: bucket, endDate: bucket };
  }
  if (/^\d{4}-\d{2}-\d{2} \d{2}:00$/.test(bucket)) {
    const day = bucket.slice(0, 10);
    return { startDate: day, endDate: day };
  }
  if (/^\d{4}-\d{2}$/.test(bucket)) {
    const date = new Date(`${bucket}-01T00:00:00`);
    return {
      startDate: format(startOfMonth(date), "yyyy-MM-dd"),
      endDate: format(endOfMonth(date), "yyyy-MM-dd"),
    };
  }
  if (/^\d{4}$/.test(bucket)) {
    const date = new Date(`${bucket}-01-01T00:00:00`);
    return {
      startDate: format(startOfYear(date), "yyyy-MM-dd"),
      endDate: format(endOfYear(date), "yyyy-MM-dd"),
    };
  }
  return null;
}
