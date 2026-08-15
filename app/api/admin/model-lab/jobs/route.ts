import { NextResponse } from "next/server";
import { getModelLabAccess } from "@/lib/auth/model-lab-access";

export async function GET() {
  const access = await getModelLabAccess();
  if (access.status !== "ok") return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

  const { data, error } = await access.supabase
    .from("model_lab_jobs")
    .select("id, job_type, provider, model_id, prompt, status, output_path, metadata, created_at, completed_at")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data || [] });
}
