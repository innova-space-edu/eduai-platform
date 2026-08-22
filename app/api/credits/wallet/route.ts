import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { ensureWallet } from "@/lib/credits/server"

export const runtime = "nodejs"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 })

    const wallet = await ensureWallet(user.id)
    const { data: transactions, error: txError } = await supabase
      .from("ai_credit_transactions")
      .select("id,kind,amount_credits,balance_after,source_type,source_id,metadata,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)

    if (txError) throw new Error(txError.message)

    return NextResponse.json({
      ok: true,
      wallet,
      transactions: (transactions || []).map((tx) => ({
        id: tx.id,
        kind: tx.kind,
        amountCredits: Number(tx.amount_credits),
        balanceAfter: Number(tx.balance_after),
        sourceType: tx.source_type,
        sourceId: tx.source_id,
        metadata: tx.metadata,
        createdAt: tx.created_at,
      })),
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "No se pudo leer el saldo." }, { status: 500 })
  }
}
