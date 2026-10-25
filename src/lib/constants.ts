import {
  IndianRupee,
  LayoutDashboard,
  ListChecks,
  Target,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export const ROLES = ["owner", "manager", "employee", "intern"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  manager: "Manager",
  employee: "Employee",
  intern: "Intern",
};

export const LEAD_STATUSES = [
  "upcoming",
  "pending",
  "ongoing",
  "confirmed",
  "cancelled",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  upcoming: "Upcoming",
  pending: "Pending",
  ongoing: "Ongoing",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};

export const TASK_STATUSES = [
  "todo",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const TASK_TYPES = ["daily", "weekly", "one_time"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  daily: "Daily",
  weekly: "Weekly",
  one_time: "One-time",
};

export const PAYMENT_STATUSES = ["pending", "partial", "paid"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Pending",
  partial: "Partial",
  paid: "Paid",
};

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  roles?: Role[];
};

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Tasks", href: "/tasks", icon: ListChecks },
  {
    title: "Team",
    href: "/team",
    icon: Users,
    roles: ["owner", "manager"],
  },
  { title: "Leads", href: "/leads", icon: Target },
  { title: "Sales", href: "/sales", icon: IndianRupee },
  { title: "Salary", href: "/salary", icon: Wallet },
];

export const LEAD_KINDS = ["product", "service"] as const;
export type LeadKind = (typeof LEAD_KINDS)[number];

export const LEAD_KIND_LABELS: Record<LeadKind, string> = {
  product: "Product",
  service: "Service",
};

export const LEAD_FREQUENCIES = ["daily", "weekly"] as const;
export type LeadFrequency = (typeof LEAD_FREQUENCIES)[number];

export const LEAD_FREQUENCY_LABELS: Record<LeadFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
};

export const PAYOUT_STATUSES = ["pending", "paid"] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export const BRAND_COLORS = {
  orange: "#FF9A00",
  red: "#F72D3F",
  green: "#3DB54A",
  teal: "#0FA98A",
  blue: "#2D86E8",
} as const;

export const CHART_COLORS = [
  BRAND_COLORS.blue,
  BRAND_COLORS.green,
  BRAND_COLORS.orange,
  BRAND_COLORS.teal,
  BRAND_COLORS.red,
];
