import type { Metadata } from "next";

import { SaleDetail } from "@/components/sales/sale-detail";

export const metadata: Metadata = { title: "Sale" };
export const instant = false;

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <SaleDetail saleId={id} />;
}
