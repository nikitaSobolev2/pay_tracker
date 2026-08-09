/** Shared rainbow treatment for AI analyzer UI (events + travels). */
export const AI_RAINBOW_GRADIENT =
  "linear-gradient(120deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3, #54a0ff, #ff6b6b)";

export const AI_RAINBOW_BORDER_CLASS = "relative rounded-xl p-px";

export const AI_RAINBOW_BORDER_STYLE = {
  backgroundImage: AI_RAINBOW_GRADIENT,
} as const;

export const AI_RAINBOW_FILL_CLASS = "rounded-[calc(0.75rem-1px)] bg-background";

/**
 * Title accent — solid color in `.ai-rainbow-text` (globals.css).
 * Not bg-clip-text: dialog popups use transform centering, which breaks clip-text.
 */
export const AI_RAINBOW_TEXT_CLASS = "ai-rainbow-text";

export const AI_RAINBOW_TEXT_STYLE = {} as const;

/** Soft button shell: rainbow ring, quiet fill — special without neon blob. */
export const AI_BUTTON_SHELL_CLASS =
  "relative inline-flex h-9 shrink-0 items-center rounded-xl border-0 bg-transparent p-px transition-opacity hover:opacity-90";

export const AI_BUTTON_INNER_CLASS =
  "relative inline-flex h-full w-full items-center gap-1.5 rounded-[calc(0.75rem-1px)] bg-card px-3 text-sm font-medium text-foreground";
