import { setRequestLocale } from "next-intl/server";

import { CategoriesPage } from "@/features/categories/categories-page";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function CategoriesRoute({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CategoriesPage />;
}
