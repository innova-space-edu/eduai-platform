import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KNOWLEDGE_DIR = path.join(process.cwd(), "artifacts", "ai", "knowledge");
const INDEX_PATH = path.join(KNOWLEDGE_DIR, "index.json");

async function requireAdmin() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data } = await supabase.from("admin_emails").select("email").eq("email", user.email).maybeSingle();
  return data ? user : null;
}

export async function GET(request: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

  try {
    const indexRaw = await readFile(INDEX_PATH, "utf8");
    const index = JSON.parse(indexRaw) as {
      shards?: Array<{ index: number; file: string; records: number; bytes: number }>;
    };
    const shardParam = request.nextUrl.searchParams.get("shard");

    if (shardParam === null) {
      return new NextResponse(indexRaw, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "private, no-store, max-age=0",
        },
      });
    }

    const shardIndex = Number(shardParam);
    if (!Number.isInteger(shardIndex) || shardIndex < 0) {
      return NextResponse.json({ error: "Shard inválido" }, { status: 400 });
    }

    const shard = index.shards?.find((item) => item.index === shardIndex);
    if (!shard || !/^shard-\d{4}\.json$/.test(shard.file)) {
      return NextResponse.json({ error: "Shard no encontrado" }, { status: 404 });
    }

    const content = await readFile(path.join(KNOWLEDGE_DIR, shard.file), "utf8");
    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Knowledge Pack no disponible" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
}
