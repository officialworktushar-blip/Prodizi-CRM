import type { Metadata } from "next";
import { LayoutDashboard } from "lucide-react";

import { PagePlaceholder } from "@/components/shared/page-placeholder";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <PagePlaceholder
      title="Dashboard"
      description="Your team's performance, revenue and targets at a glance."
      icon={LayoutDashboard}
      eyebrow="Overview"
    />
  );
}
