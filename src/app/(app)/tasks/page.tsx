import type { Metadata } from "next";
import { ListChecks } from "lucide-react";

import { PagePlaceholder } from "@/components/shared/page-placeholder";

export const metadata: Metadata = { title: "Tasks" };

export default function TasksPage() {
  return (
    <PagePlaceholder
      title="Tasks"
      description="Plan daily, weekly and one-time work across the team."
      icon={ListChecks}
      eyebrow="Work"
    />
  );
}
