import { toNumber } from "@/lib/utils";
import type { AssigneeWorkload, Profile } from "@/types/database";

export type AssignmentLead = {
  kind?: string | null;
  item_name?: string | null;
};

export type AssignmentCandidate = {
  member: Profile;
  workload: AssigneeWorkload | null;
  score: number;
  reasons: string[];
};

export type AssignmentMode = "round_robin" | "least_loaded";

const KEYWORD_STOPWORDS = new Set([
  "and",
  "the",
  "for",
  "with",
  "from",
  "service",
  "product",
  "work",
  "sales",
  "team",
  "client",
]);

function keywords(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !KEYWORD_STOPWORDS.has(word));
}

function hasKeywordMatch(member: Profile, lead: AssignmentLead) {
  const memberTerms = new Set([
    ...keywords(member.dedicated_work),
    ...keywords(member.designation),
    ...keywords(member.position),
  ]);
  const leadTerms = [...keywords(lead.item_name), ...keywords(lead.kind)];

  return leadTerms.some((term) => memberTerms.has(term));
}

export function scoreAssignmentCandidate(
  member: Profile,
  workload: AssigneeWorkload | null,
  lead: AssignmentLead,
) {
  const reasons: string[] = [];
  let score = 0;

  if (hasKeywordMatch(member, lead)) {
    score += 3;
    reasons.push("Matches work focus");
  }

  const openLeads = toNumber(workload?.open_leads);
  if (openLeads > 0) {
    score -= Math.floor(openLeads / 5);
    if (openLeads <= 5) reasons.push("Light lead load");
  }

  const performance = toNumber(workload?.performance_pct);
  score += performance / 50;
  if (performance >= 70) reasons.push("Strong performance");

  const pendingTasks = toNumber(workload?.tasks_pending);
  if (pendingTasks > 15) {
    score -= 2;
    reasons.push("Heavy task load");
  }

  return { score, reasons };
}

export function rankAssignmentCandidates(
  members: Profile[],
  workloads: AssigneeWorkload[],
  lead: AssignmentLead = {},
) {
  const workloadMap = new Map(
    workloads
      .filter((row) => row.user_id)
      .map((row) => [row.user_id as string, row]),
  );

  return members
    .map((member) => {
      const workload = workloadMap.get(member.id) ?? null;
      const { score, reasons } = scoreAssignmentCandidate(
        member,
        workload,
        lead,
      );
      return { member, workload, score, reasons };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const loadDiff =
        toNumber(a.workload?.open_leads) - toNumber(b.workload?.open_leads);
      if (loadDiff !== 0) return loadDiff;
      return a.member.full_name.localeCompare(b.member.full_name);
    });
}

export function buildAssignmentPlan<L extends AssignmentLead>({
  leads,
  candidates,
  mode,
}: {
  leads: L[];
  candidates: AssignmentCandidate[];
  mode: AssignmentMode;
}) {
  const selected = candidates.filter((candidate) => candidate.member.is_active);
  if (selected.length === 0) return [];

  if (mode === "round_robin") {
    return leads.map((lead, index) => ({
      lead,
      candidate: selected[index % selected.length],
    }));
  }

  const assignedCounts = new Map<string, number>();
  return leads.map((lead) => {
    const candidate = [...selected].sort((a, b) => {
      const aLoad =
        toNumber(a.workload?.open_leads) +
        (assignedCounts.get(a.member.id) ?? 0);
      const bLoad =
        toNumber(b.workload?.open_leads) +
        (assignedCounts.get(b.member.id) ?? 0);
      if (aLoad !== bLoad) return aLoad - bLoad;
      if (b.score !== a.score) return b.score - a.score;
      return a.member.full_name.localeCompare(b.member.full_name);
    })[0];

    assignedCounts.set(
      candidate.member.id,
      (assignedCounts.get(candidate.member.id) ?? 0) + 1,
    );
    return { lead, candidate };
  });
}
