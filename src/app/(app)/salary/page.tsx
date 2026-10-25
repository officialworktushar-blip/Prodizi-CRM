import type { Metadata } from "next";
import { Wallet } from "lucide-react";

import { PagePlaceholder } from "@/components/shared/page-placeholder";

export const metadata: Metadata = { title: "Salary" };

export default function SalaryPage() {
  return (
    <PagePlaceholder
      title="Salary"
      description="Monthly salary, allowances and earned incentives."
      icon={Wallet}
      eyebrow="Compensation"
    />
  );
}
