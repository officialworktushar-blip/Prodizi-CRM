import { clsx, type ClassValue } from "clsx";
import {
  endOfMonth,
  format,
  formatDistanceToNow,
  isValid,
  parseISO,
  startOfMonth,
} from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toNumber(value: number | string | null | undefined) {
  const parsed = typeof value === "string" ? Number(value) : (value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatINR(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

export function formatCompactINR(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(toNumber(value));
}

export function formatPercent(value: number | null | undefined) {
  return `${Math.round(toNumber(value))}%`;
}

export function parseDate(value: Date | string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;

  const date =
    value instanceof Date
      ? value
      : typeof value === "string"
        ? /^\d{4}-\d{2}-\d{2}$/.test(value)
          ? parseISO(value)
          : new Date(value)
        : new Date(value);

  return isValid(date) ? date : null;
}

export function formatDate(value: Date | string | number | null | undefined) {
  const date = parseDate(value);
  return date ? format(date, "dd MMM yyyy") : "—";
}

export function formatDateTime(
  value: Date | string | number | null | undefined,
) {
  const date = parseDate(value);
  return date ? format(date, "dd MMM yyyy, hh:mm a") : "—";
}

export function formatRelative(
  value: Date | string | number | null | undefined,
) {
  const date = parseDate(value);
  return date ? formatDistanceToNow(date, { addSuffix: true }) : "—";
}

export function todayISO(value: Date = new Date()) {
  return format(value, "yyyy-MM-dd");
}

export function isTaskOverdue(
  task: {
    due_date: string | null;
    status: string;
  },
  today = todayISO(),
) {
  return Boolean(
    task.due_date &&
    task.due_date < today &&
    task.status !== "completed" &&
    task.status !== "cancelled",
  );
}

export function monthStartISO(value: Date | string | number = new Date()) {
  return format(startOfMonth(parseDate(value) ?? new Date()), "yyyy-MM-dd");
}

export function monthEndISO(value: Date | string | number = new Date()) {
  return format(endOfMonth(parseDate(value) ?? new Date()), "yyyy-MM-dd");
}

export function getInitials(name: string | null | undefined) {
  if (!name) return "?";

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
