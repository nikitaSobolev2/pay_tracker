import { setRequestLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstQueryValue(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export default async function EarningsRoute({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);

  const nextQuery: Record<string, string> = { type: "earning" };
  const categoryIds = firstQueryValue(query.categoryIds);
  if (categoryIds) {
    nextQuery.categoryIds = categoryIds;
  }

  redirect({
    href: { pathname: "/transactions", query: nextQuery },
    locale,
  });
}
