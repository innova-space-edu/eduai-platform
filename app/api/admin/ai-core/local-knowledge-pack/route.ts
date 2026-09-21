import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PACK_PATH = path.join(process.cwd(), "artifacts", "ai", "eduai-local-knowledge-pack.json");

async function requireAdmin() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data } = await supabase.from("admin_emails").select("email").eq("email", user.email).maybeSingle();
  return data ? user : null;
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

  try {
    const content = await readFile(PACK_PATH, "utf8");
    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": "inline; filename=eduai-local-knowledge-pack.json",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Knowledge Pack no disponible" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
}
