"use client";

import { formatInTimeZone } from "date-fns-tz";

import { cn } from "@/lib/utils";

export type TravelClockProps = {
  readonly nowMs: number;
  readonly timezone: string;
  readonly title: string;
  readonly subtitle?: string | null;
  readonly className?: string;
};

const FACE_SIZE = 132;
const CENTER = FACE_SIZE / 2;
const HOUR_LENGTH = 34;
const MINUTE_LENGTH = 46;
const SECOND_LENGTH = 52;

/** One analog + digital clock bound to an IANA timezone. */
export function TravelClock({
  nowMs,
  timezone,
  title,
  subtitle,
  className,
}: TravelClockProps) {
  const parts = getClockParts(nowMs, timezone);
  const hourAngle =
    ((parts.hour % 12) + parts.minute / 60 + parts.second / 3600) * 30;
  const minuteAngle = (parts.minute + parts.second / 60) * 6;
  const secondAngle = parts.second * 6;

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-card/40 px-4 py-5",
        className,
      )}
    >
      <p className="text-center text-sm font-medium text-foreground">{title}</p>
      <svg
        width={FACE_SIZE}
        height={FACE_SIZE}
        viewBox={`0 0 ${FACE_SIZE} ${FACE_SIZE}`}
        className="shrink-0 text-foreground"
        aria-hidden
      >
        <circle
          cx={CENTER}
          cy={CENTER}
          r={CENTER - 2}
          fill="none"
          className="stroke-border"
          strokeWidth={2}
        />
        {Array.from({ length: 12 }, (_, index) => {
          const angle = (index * 30 * Math.PI) / 180;
          const inner = CENTER - 10;
          const outer = CENTER - 4;
          return (
            <line
              key={index}
              x1={CENTER + inner * Math.sin(angle)}
              y1={CENTER - inner * Math.cos(angle)}
              x2={CENTER + outer * Math.sin(angle)}
              y2={CENTER - outer * Math.cos(angle)}
              className="stroke-muted-foreground"
              strokeWidth={index % 3 === 0 ? 2.5 : 1.5}
              strokeLinecap="round"
            />
          );
        })}
        <ClockHand
          length={HOUR_LENGTH}
          angleDegrees={hourAngle}
          className="stroke-foreground"
          strokeWidth={3.5}
        />
        <ClockHand
          length={MINUTE_LENGTH}
          angleDegrees={minuteAngle}
          className="stroke-foreground"
          strokeWidth={2.5}
        />
        <ClockHand
          length={SECOND_LENGTH}
          angleDegrees={secondAngle}
          className="stroke-destructive"
          strokeWidth={1.5}
        />
        <circle cx={CENTER} cy={CENTER} r={3.5} className="fill-foreground" />
        <circle cx={CENTER} cy={CENTER} r={1.5} className="fill-destructive" />
      </svg>
      <div className="space-y-1 text-center">
        <p className="font-mono text-2xl font-semibold tracking-tight tabular-nums">
          {parts.digital}
        </p>
        {subtitle ? (
          <p className="max-w-[11rem] truncate text-xs text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ClockHand({
  length,
  angleDegrees,
  className,
  strokeWidth,
}: {
  readonly length: number;
  readonly angleDegrees: number;
  readonly className: string;
  readonly strokeWidth: number;
}) {
  const radians = (angleDegrees * Math.PI) / 180;
  return (
    <line
      x1={CENTER}
      y1={CENTER}
      x2={CENTER + length * Math.sin(radians)}
      y2={CENTER - length * Math.cos(radians)}
      className={className}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  );
}

type ClockParts = {
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly digital: string;
};

function getClockParts(nowMs: number, timezone: string): ClockParts {
  try {
    const date = new Date(nowMs);
    const hour = Number(formatInTimeZone(date, timezone, "H"));
    const minute = Number(formatInTimeZone(date, timezone, "m"));
    const second =
      Number(formatInTimeZone(date, timezone, "s")) +
      (nowMs % 1000) / 1000;
    const digital = formatInTimeZone(date, timezone, "HH:mm:ss");
    return { hour, minute, second, digital };
  } catch {
    const date = new Date(nowMs);
    return {
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      second: date.getUTCSeconds() + (nowMs % 1000) / 1000,
      digital: "––:––:––",
    };
  }
}
