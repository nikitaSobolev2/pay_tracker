"use client";

import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import {
  useEffect,
  useRef,
  type ComponentProps,
  type ReactElement,
  type SVGProps,
} from "react";
import {
  DayPicker,
  getDefaultClassNames,
  type DayButton,
} from "react-day-picker";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  ...props
}: ComponentProps<typeof DayPicker> & {
  readonly buttonVariant?: ComponentProps<typeof Button>["variant"];
}) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      className={cn(
        "group/calendar w-full bg-background p-2 [--cell-size:2.75rem] sm:[--cell-size:2.5rem]",
        className,
      )}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-full", defaultClassNames.root),
        months: cn(
          "relative flex w-full flex-col gap-4 md:flex-row",
          defaultClassNames.months,
        ),
        month: cn("flex w-full flex-col gap-3", defaultClassNames.month),
        month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-(--cell-size) shrink-0 rounded-xl p-0 select-none aria-disabled:opacity-50",
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-(--cell-size) shrink-0 rounded-xl p-0 select-none aria-disabled:opacity-50",
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          "flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)",
          defaultClassNames.month_caption,
        ),
        dropdowns: cn(
          "flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium",
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn(
          "relative rounded-md border border-input shadow-xs has-focus:border-ring has-focus:ring-[3px] has-focus:ring-ring/50",
          defaultClassNames.dropdown_root,
        ),
        dropdown: cn("absolute inset-0 opacity-0", defaultClassNames.dropdown),
        caption_label: cn(
          "font-medium select-none",
          captionLayout === "label"
            ? "text-sm"
            : "flex h-8 items-center gap-1 rounded-md pr-1 pl-2 text-sm [&>svg]:size-3.5 [&>svg]:text-muted-foreground",
          defaultClassNames.caption_label,
        ),
        weekdays: cn("flex w-full", defaultClassNames.weekdays),
        weekday: cn(
          "flex-1 basis-0 rounded-md text-center text-xs font-medium text-muted-foreground select-none",
          defaultClassNames.weekday,
        ),
        week: cn("mt-1 flex w-full", defaultClassNames.week),
        day: cn(
          "group/day relative flex flex-1 basis-0 items-center justify-center p-0 text-center select-none",
          "[&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md",
          defaultClassNames.day,
        ),
        range_start: cn("rounded-l-md bg-accent", defaultClassNames.range_start),
        range_middle: cn("rounded-none bg-accent", defaultClassNames.range_middle),
        range_end: cn("rounded-r-md bg-accent", defaultClassNames.range_end),
        today: cn(
          "rounded-md bg-muted text-foreground data-[selected=true]:rounded-none",
          defaultClassNames.today,
        ),
        outside: cn(
          "text-muted-foreground/55 aria-selected:text-muted-foreground",
          defaultClassNames.outside,
        ),
        disabled: cn(
          "text-muted-foreground opacity-40",
          defaultClassNames.disabled,
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Chevron: CalendarChevron,
        DayButton: CalendarDayButton,
        ...components,
      }}
      {...props}
    />
  );
}

function CalendarChevron({
  orientation,
  className,
  ...props
}: {
  readonly orientation?: "left" | "right" | "up" | "down";
  readonly className?: string;
} & SVGProps<SVGSVGElement>) {
  if (orientation === "left") {
    return <ChevronLeftIcon className={cn("size-4", className)} {...props} />;
  }
  if (orientation === "right") {
    return <ChevronRightIcon className={cn("size-4", className)} {...props} />;
  }
  return <ChevronDownIcon className={cn("size-4", className)} {...props} />;
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  children,
  ...props
}: ComponentProps<typeof DayButton>): ReactElement {
  const defaultClassNames = getDefaultClassNames();
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (modifiers.focused) {
      ref.current?.focus();
    }
  }, [modifiers.focused]);

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "flex aspect-square size-(--cell-size) max-h-(--cell-size) w-full min-w-(--cell-size) flex-col gap-1 leading-none font-normal",
        "group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-ring/50",
        "data-[selected-single=true]:bg-foreground data-[selected-single=true]:text-background data-[selected-single=true]:hover:bg-foreground",
        "data-[range-start=true]:rounded-l-md data-[range-start=true]:bg-foreground data-[range-start=true]:text-background",
        "data-[range-end=true]:rounded-r-md data-[range-end=true]:bg-foreground data-[range-end=true]:text-background",
        "data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground",
        defaultClassNames.day,
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  );
}

export { Calendar, CalendarDayButton };
