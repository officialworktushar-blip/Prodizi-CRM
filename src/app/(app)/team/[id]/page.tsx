import type { Metadata } from "next";
import { UserRound } from "lucide-react";

import { PagePlaceholder } from "@/components/shared/page-placeholder";

export const metadata: Metadata = { title: "Team member" };
export const instant = false;

export default async function TeamMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <PagePlaceholder
      title={`Team member #${id}`}
      description="Profile, targets, performance and salary configuration."
      icon={UserRound}
      eyebrow="Team"
    />
  );
}
