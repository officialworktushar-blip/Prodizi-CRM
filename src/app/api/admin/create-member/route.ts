import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient, createClient } from "@/lib/supabase/server";

const createMemberSchema = z.object({
  full_name: z.string().trim().min(2, "Name is too short").max(120),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().trim().max(30).optional().nullable(),
  role: z.enum(["owner", "manager", "employee", "intern"]),
  designation: z.string().trim().max(120).optional().nullable(),
  position: z.string().trim().max(120).optional().nullable(),
  dedicated_work: z.string().trim().max(240).optional().nullable(),
  joined_on: z.string().optional().nullable(),
  base_salary: z.coerce.number().min(0).default(0),
  sales_incentive_percent: z.coerce.number().min(0).max(100).default(0),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: actor } = await supabase
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!actor?.is_active || !["owner", "manager"].includes(actor.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = createMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid details" },
      { status: 400 },
    );
  }

  const input = parsed.data;
  if (
    actor.role === "manager" &&
    !["employee", "intern"].includes(input.role)
  ) {
    return NextResponse.json(
      { error: "Managers can only create employees and interns" },
      { status: 403 },
    );
  }

  const admin = createAdminClient();
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: input.full_name,
      role: input.role,
      phone: input.phone ?? null,
    },
  });

  if (authError || !created.user) {
    return NextResponse.json(
      { error: authError?.message ?? "Could not create the account" },
      { status: 400 },
    );
  }

  const userId = created.user.id;

  const { error: profileError } = await admin.from("profiles").upsert({
    id: userId,
    full_name: input.full_name,
    email: input.email,
    phone: input.phone ?? null,
    role: input.role,
    designation: input.designation ?? null,
    position: input.position ?? null,
    dedicated_work: input.dedicated_work ?? null,
    joined_on: input.joined_on || null,
    is_active: true,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json(
      { error: profileError.message },
      { status: 400 },
    );
  }

  const { error: salaryError } = await admin.from("salary_config").upsert({
    user_id: userId,
    base_salary: actor.role === "owner" ? input.base_salary : 0,
    sales_incentive_percent:
      actor.role === "owner" ? input.sales_incentive_percent : 0,
  });

  if (salaryError) {
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json(
      { error: salaryError.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ id: userId }, { status: 201 });
}
