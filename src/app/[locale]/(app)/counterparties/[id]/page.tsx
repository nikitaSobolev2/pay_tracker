import { CounterpartyDetailPage } from "@/features/counterparties/counterparty-detail-page";

export default async function CounterpartyDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CounterpartyDetailPage id={id} />;
}
