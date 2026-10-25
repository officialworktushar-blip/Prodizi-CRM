import type { Metadata } from "next";
import { IndianRupee } from "lucide-react";

import { PagePlaceholder } from "@/components/shared/page-placeholder";

export const metadata: Metadata = { title: "Sale" };
export const instant = false;

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <PagePlaceholder
      title={`Sale #${id}`}
      description="Deal value, payment history and linked incentives."
      icon={IndianRupee}
      eyebrow="Revenue"
    />
  );
}
