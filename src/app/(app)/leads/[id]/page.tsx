import type { Metadata } from "next";
import { Target } from "lucide-react";

import { PagePlaceholder } from "@/components/shared/page-placeholder";

export const metadata: Metadata = { title: "Lead" };
export const instant = false;

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <PagePlaceholder
      title={`Lead #${id}`}
      description="Contact details, follow-ups, linked task and conversion status."
      icon={Target}
      eyebrow="Pipeline"
    />
  );
}
