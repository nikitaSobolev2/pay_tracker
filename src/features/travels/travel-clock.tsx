"use client";

import { formatInTimeZone } from "date-fns-tz";

import { cn } from "@/lib/utils";

export type TravelClockProps = {
  readonly nowMs: number;
  readonly timezone: string;
  readonly title: string;
  readonly placeLabel?: string | null;
  readonly className?: string;
  /** Visual accent — destination dial uses a warmer second hand. */
  readonly tone?: "you" | "destination";
};

const FACE_SIZE = 148;
const CENTER = FACE_SIZE / 2;

/** One analog + digital clock bound to an IANA timezone. */
export function TravelClock({
  nowMs,
  timezone,
  title,
  placeLabel,
  className,
  tone = "you",
}: TravelClockProps) {
  const parts = getClockParts(nowMs, timezone);
  const hourAngle =
    ((parts.hour % 12) + parts.minute / 60 + parts.second / 3600) * 30;
  const minuteAngle = (parts.minute + parts.second / 60) * 6;
  const secondAngle = parts.second * 6;
  const zoneShort = shortTimezoneLabel(timezone);

  return (
    <div
      className={cn(
        "travel-clock flex h-full flex-col items-center gap-4 rounded-2xl px-4 py-5",
        tone === "destination" ? "travel-clock--destination" : "travel-clock--you",
        className,
      )}
    >
      <div className="space-y-0.5 text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </p>
        {placeLabel ? (
          <p className="max-w-[12rem] truncate text-sm font-medium text-foreground">
            {placeLabel}
          </p>
        ) : null}
      </div>

      <div className="travel-clock__face relative">
        <svg
          width={FACE_SIZE}
          height={FACE_SIZE}
          viewBox={`0 0 ${FACE_SIZE} ${FACE_SIZE}`}
          className="shrink-0"
          aria-hidden
        >
          <circle
            cx={CENTER}
            cy={CENTER}
            r={CENTER - 1}
            className="travel-clock__rim fill-none"
            strokeWidth={1.25}
          />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={CENTER - 6}
            className="travel-clock__dial"
          />
          {Array.from({ length: 60 }, (_, index) => {
            const angle = (index * 6 * Math.PI) / 180;
            const isHour = index % 5 === 0;
            const inner = CENTER - (isHour ? 18 : 12);
            const outer = CENTER - 8;
            return (
              <line
                key={index}
                x1={CENTER + inner * Math.sin(angle)}
                y1={CENTER - inner * Math.cos(angle)}
                x2={CENTER + outer * Math.sin(angle)}
                y2={CENTER - outer * Math.cos(angle)}
                className={
                  isHour
                    ? "travel-clock__tick-hour"
                    : "travel-clock__tick-minute"
                }
                strokeWidth={isHour ? 2 : 1}
                strokeLinecap="round"
              />
            );
          })}
          {[12, 3, 6, 9].map((hour) => {
            const angle = ((hour % 12) * 30 * Math.PI) / 180;
            const radius = CENTER - 28;
            return (
              <text
                key={hour}
                x={CENTER + radius * Math.sin(angle)}
                y={CENTER - radius * Math.cos(angle)}
                textAnchor="middle"
                dominantBaseline="central"
                className="travel-clock__num fill-muted-foreground"
                fontSize={11}
                fontWeight={500}
              >
                {hour}
              </text>
            );
          })}
          <ClockHand
            length={36}
            angleDegrees={hourAngle}
            className="travel-clock__hand-hour"
            strokeWidth={3.75}
          />
          <ClockHand
            length={48}
            angleDegrees={minuteAngle}
            className="travel-clock__hand-minute"
            strokeWidth={2.5}
          />
          <line
            x1={CENTER - 10 * Math.sin((secondAngle * Math.PI) / 180)}
            y1={CENTER + 10 * Math.cos((secondAngle * Math.PI) / 180)}
            x2={CENTER + 56 * Math.sin((secondAngle * Math.PI) / 180)}
            y2={CENTER - 56 * Math.cos((secondAngle * Math.PI) / 180)}
            className="travel-clock__hand-second"
            strokeWidth={1.25}
            strokeLinecap="round"
          />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={4}
            className="travel-clock__hub"
          />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={1.75}
            className="travel-clock__hub-dot"
          />
        </svg>
      </div>

      <div className="space-y-1.5 text-center">
        <p className="font-mono text-[1.65rem] font-semibold leading-none tracking-tight tabular-nums text-foreground">
          {parts.digital}
        </p>
        <p className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground/80">{zoneShort}</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{parts.offset}</span>
        </p>
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
  readonly offset: string;
};

function getClockParts(nowMs: number, timezone: string): ClockParts {
  try {
    const date = new Date(nowMs);
    const hour = Number(formatInTimeZone(date, timezone, "H"));
    const minute = Number(formatInTimeZone(date, timezone, "m"));
    const second =
      Number(formatInTimeZone(date, timezone, "s")) + (nowMs % 1000) / 1000;
    const digital = formatInTimeZone(date, timezone, "HH:mm:ss");
    const offset = formatInTimeZone(date, timezone, "XXX");
    return { hour, minute, second, digital, offset };
  } catch {
    return {
      hour: 0,
      minute: 0,
      second: 0,
      digital: "––:––:––",
      offset: "UTC",
    };
  }
}

function shortTimezoneLabel(timezone: string): string {
  const parts = timezone.split("/");
  const city = parts[parts.length - 1] ?? timezone;
  return city.replaceAll("_", " ");
}
