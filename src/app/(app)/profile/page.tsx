import type { Metadata } from "next";
import { UserRound } from "lucide-react";

import { PagePlaceholder } from "@/components/shared/page-placeholder";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <PagePlaceholder
      title="Profile"
      description="Manage your personal details and account password."
      icon={UserRound}
      eyebrow="Account"
    />
  );
}
