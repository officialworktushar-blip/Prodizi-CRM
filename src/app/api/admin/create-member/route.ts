import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Member creation is not available yet. It will be implemented in the team management phase.",
    },
    { status: 501 },
  );
}
