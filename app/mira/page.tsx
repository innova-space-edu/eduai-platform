import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import MiraAssistant from "@/components/mira/MiraAssistant"

export default async function MiraPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  return (
    <main className="min-h-screen bg-slate-950 px-3 py-4 text-white sm:px-5 sm:py-6">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link href="/agentes" className="text-sm font-semibold text-slate-400 hover:text-white">← Agentes</Link>
          <Link href="/dashboard" className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/10">Dashboard</Link>
        </div>
        <MiraAssistant />
      </div>
    </main>
  )
}
