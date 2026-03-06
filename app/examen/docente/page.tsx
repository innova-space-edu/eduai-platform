// src/app/examen/docente/page.tsx
"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function ExamenesDocentePage() {
  const [user, setUser] = useState<any>(null)
  const [exams, setExams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push("/login"); return }
      setUser(user)

      const res = await fetch(`/api/agents/examen-docente?teacherId=${user.id}`)
      const data = await res.json()
      setExams(data.exams || [])
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-blue-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-500 hover:text-white">←</Link>
            <div>
              <h1 className="text-xl font-bold text-white">📝 Exámenes para Docentes</h1>
              <p className="text-gray-500 text-sm">Crea exámenes y comparte el link con tus estudiantes</p>
            </div>
          </div>
          <Link href="/examen/crear"
            className="px-4 py-2 rounded-xl bg-blue-600/90 text-white text-xs font-bold hover:bg-blue-500">
            + Crear examen
          </Link>
        </div>

        {exams.length === 0 ? (
          <div className="text-center py-16 bg-white/[0.02] rounded-2xl border border-white/[0.06]">
            <div className="text-4xl mb-3">📝</div>
            <h3 className="text-white font-bold mb-2">Sin exámenes aún</h3>
            <p className="text-gray-500 text-sm mb-4">Crea tu primer examen con IA y comparte el link</p>
            <Link href="/examen/crear"
              className="inline-block px-6 py-2.5 rounded-2xl bg-blue-600/90 text-white text-sm font-bold">
              Crear mi primer examen
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {exams.map((exam) => (
              <Link key={exam.id} href={`/examen/resultados/${exam.id}`}
                className="block bg-gray-900/60 border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-all group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-bold text-sm truncate group-hover:text-blue-400 transition-colors">
                        {exam.title}
                      </h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        exam.status === "active"
                          ? "bg-green-500/10 text-green-400"
                          : "bg-gray-500/10 text-gray-500"
                      }`}>
                        {exam.status === "active" ? "Activo" : "Cerrado"}
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs">{exam.topic}</p>
                    <div className="flex gap-4 mt-2">
                      <span className="text-gray-600 text-xs">📋 {exam.settings?.questionCount || "?"} preguntas</span>
                      <span className="text-gray-600 text-xs">⏱ {exam.settings?.timeLimit || "?"} min</span>
                      <span className="text-gray-600 text-xs">
                        {new Date(exam.created_at).toLocaleDateString("es-CL")}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-blue-400 font-bold text-lg">{exam.submissionCount}</p>
                    <p className="text-gray-600 text-[10px]">respuestas</p>
                    <p className="text-gray-700 font-mono text-xs mt-1">{exam.code}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
