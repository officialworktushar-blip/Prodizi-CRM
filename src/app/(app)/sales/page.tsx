import type { Metadata } from "next";
import { IndianRupee } from "lucide-react";

import { PagePlaceholder } from "@/components/shared/page-placeholder";

export const metadata: Metadata = { title: "Sales" };

export default function SalesPage() {
  return (
    <PagePlaceholder
      title="Sales"
      description="Revenue, payments and incentive attribution for the team."
      icon={IndianRupee}
      eyebrow="Revenue"
    />
  );
}
