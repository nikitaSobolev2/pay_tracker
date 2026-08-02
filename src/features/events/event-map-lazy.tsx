"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

export const EventMapLazy = dynamic(
  () => import("./event-map").then((module) => module.EventMap),
  {
    ssr: false,
    loading: () => <Skeleton className="size-full min-h-40 rounded-xl" />,
  },
);
