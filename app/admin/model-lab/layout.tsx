"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function ModelLabLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [allowed, setAllowed] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let active = true
    const supabase = createClient()

    async function verify() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!active) return
      if (!user?.email) {
        router.replace("/login")
        setChecked(true)
        return
      }

      const { data, error } = await supabase
        .from("admin_emails")
        .select("email")
        .eq("email", user.email)
        .maybeSingle()

      if (!active) return
      if (error || !data) {
        router.replace("/admin")
        setChecked(true)
        return
      }

      setAllowed(true)
      setChecked(true)
    }

    void verify()
    return () => { active = false }
  }, [router])

  if (!checked || !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-300" />
          <p className="mt-3 text-sm">Verificando acceso de administrador…</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
