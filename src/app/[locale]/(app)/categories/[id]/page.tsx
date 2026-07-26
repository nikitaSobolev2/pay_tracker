import { CategoryDetailPage } from "@/features/categories/category-detail-page";

export default async function CategoryDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CategoryDetailPage id={id} />;
}
