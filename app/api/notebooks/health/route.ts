import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabase = await createClient()

    const checks: Record<string, { ok: boolean; error?: string }> = {}

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

    let rpcOk = false

    try {
      const { error } = await supabase.rpc("match_notebook_chunks", {
        p_notebook_id: "00000000-0000-0000-0000-000000000000",
        p_embedding: "[" + Array(768).fill(0).join(",") + "]",
        p_limit: 1,
        p_active_only: true,
      })

      if (error) {
        checks["rpc_match_notebook_chunks"] = {
          ok: false,
          error: error.message,
        }
      } else {
        rpcOk = true
        checks["rpc_match_notebook_chunks"] = { ok: true }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      checks["rpc_match_notebook_chunks"] = msg.includes("does not exist")
        ? { ok: false, error: "Función no existe — ejecutar migration.sql" }
        : { ok: false, error: msg }
    }

    // Si el RPC vectorial funciona, pgvector está operativo para la app.
    checks["pgvector_extension"] = rpcOk
      ? { ok: true }
      : {
          ok: false,
          error: "No se pudo verificar pgvector a través del RPC match_notebook_chunks",
        }

    const allOk = Object.values(checks).every((c) => c.ok)

    return NextResponse.json({
      ok: allOk,
      checks,
      hint: allOk
        ? "Todo está correcto."
        : "Hay uno o más checks fallando. Revisa la salida.",
    })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Error desconocido",
        hint: "Verifica variables de entorno y conexión con Supabase.",
      },
      { status: 500 }
    )
  }
}
