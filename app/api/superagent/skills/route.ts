import { NextRequest, NextResponse } from "next/server";
import { getVisibleSkills } from "@/lib/superagent/skills/skill-registry";

export async function GET(req: NextRequest) {
  const role = (req.nextUrl.searchParams.get("role") || "student") as
    | "student"
    | "teacher"
    | "admin";

  return NextResponse.json({
    ok: true,
    role,
    skills: getVisibleSkills(role),
  });
}
