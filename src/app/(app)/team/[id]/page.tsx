import type { Metadata } from "next";

import { MemberDetail } from "@/components/team/member-detail";

export const metadata: Metadata = { title: "Team member" };

export default async function TeamMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <MemberDetail memberId={id} />;
}
