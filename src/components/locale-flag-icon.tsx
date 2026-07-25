import { useId } from "react";

import { cn } from "@/lib/utils";
import { AppLocale } from "@/types/enums";

type LocaleFlagIconProps = {
  readonly locale: AppLocale;
  readonly className?: string;
};

/** Compact SVG flags for locale pickers (not emoji). */
export function LocaleFlagIcon({ locale, className }: LocaleFlagIconProps) {
  if (locale === AppLocale.Ru) {
    return <RussiaFlagIcon className={className} />;
  }
  return <UnitedKingdomFlagIcon className={className} />;
}

function UnitedKingdomFlagIcon({ className }: { readonly className?: string }) {
  const clipId = useId();

  return (
    <svg
      viewBox="0 0 60 30"
      className={cn("size-4 shrink-0 rounded-xs", className)}
      aria-hidden
    >
      <clipPath id={clipId}>
        <rect width="60" height="30" rx="2" />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <rect width="60" height="30" fill="#012169" />
        <path d="M0 0 L60 30 M60 0 L0 30" stroke="#fff" strokeWidth="6" />
        <path
          d="M0 0 L60 30 M60 0 L0 30"
          stroke="#C8102E"
          strokeWidth="2"
        />
        <path d="M30 0 V30 M0 15 H60" stroke="#fff" strokeWidth="10" />
        <path d="M30 0 V30 M0 15 H60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  );
}

function RussiaFlagIcon({ className }: { readonly className?: string }) {
  return (
    <svg
      viewBox="0 0 9 6"
      className={cn("size-4 shrink-0 rounded-xs", className)}
      aria-hidden
    >
      <rect width="9" height="6" rx="0.4" fill="#fff" />
      <rect y="2" width="9" height="2" fill="#0039A6" />
      <rect y="4" width="9" height="2" fill="#D52B1E" />
    </svg>
  );
}
