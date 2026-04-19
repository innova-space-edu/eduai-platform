// app/api/notebooks/health/route.ts
// Diagnóstico rápido — verifica que todas las tablas y funciones existen
// Visitar: /api/notebooks/health

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabase = await createClient()

    const checks: Record<string, { ok: boolean; error?: string }> = {}

    // Verificar cada tabla
    const tables = [
      "notebooks",
      "notebook_sources",
      "notebook_chunks",
      "notebook_summaries",
      "notebook_messages",
      "notebook_outputs",
    ]

    for (const table of tables) {
      const { error } = await supabase.from(table).select("id").limit(1)
      checks[table] = error
        ? { ok: false, error: error.message }
        : { ok: true }
    }

    // Verificar función RPC
    try {
      await supabase.rpc("match_notebook_chunks", {
        p_notebook_id: "00000000-0000-0000-0000-000000000000",
        p_embedding:   "[" + Array(768).fill(0).join(",") + "]",
        p_limit:       1,
        p_active_only: true,
      })
      checks["rpc_match_notebook_chunks"] = { ok: true }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // Si el error es "no rows" está OK, si es "function not found" no está
      checks["rpc_match_notebook_chunks"] = msg.includes("does not exist")
        ? { ok: false, error: "Función no existe — ejecutar migration.sql" }
        : { ok: true }
    }

    // Verificar extensión vector
    let vecOk = false
    try {
      const { data: vecData } = await supabase
        .from("pg_extension")
        .select("extname")
        .eq("extname", "vector")
        .maybeSingle()
      vecOk = !!vecData
    } catch { vecOk = false }

    checks["pgvector_extension"] = vecOk
      ? { ok: true }
      : { ok: false, error: "Extensión vector no habilitada — ejecutar: CREATE EXTENSION IF NOT EXISTS vector" }

    const allOk = Object.values(checks).every((c) => c.ok)

    return NextResponse.json({
      ok:     allOk,
      checks,
      hint:   allOk
        ? "Todo está correcto."
        : "Ejecuta migration.sql en Supabase SQL Editor. Ver checks con ok: false.",
    })
  } catch (err) {
    return NextResponse.json({
      ok:    false,
      error: err instanceof Error ? err.message : "Error desconocido",
      hint:  "Verifica que NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY estén configuradas.",
    }, { status: 500 })
  }
}
