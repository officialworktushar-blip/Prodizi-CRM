import type { Metadata } from "next";
import { Users } from "lucide-react";

import { PagePlaceholder } from "@/components/shared/page-placeholder";

export const metadata: Metadata = { title: "Team" };

export default function TeamPage() {
  return (
    <PagePlaceholder
      title="Team"
      description="Manage owners, managers, employees and interns."
      icon={Users}
      eyebrow="People"
    />
  );
}
