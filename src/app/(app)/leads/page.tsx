import type { Metadata } from "next";
import { Target } from "lucide-react";

import { PagePlaceholder } from "@/components/shared/page-placeholder";

export const metadata: Metadata = { title: "Leads" };

export default function LeadsPage() {
  return (
    <PagePlaceholder
      title="Leads"
      description="Track every opportunity from upcoming to confirmed."
      icon={Target}
      eyebrow="Pipeline"
    />
  );
}
