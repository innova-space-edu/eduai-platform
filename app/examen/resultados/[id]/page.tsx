// src/app/examen/resultados/[id]/page.tsx
"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Shield, X, AlertTriangle, Clock } from "lucide-react"

// ── Semáforo de riesgo ────────────────────────────────────────────────────────
function RiskBadge({ level, count }: { level: string; count: number }) {
  if (count === 0 || level === "clean") return (
    <span className="text-gray-700 text-xs">—</span>
  )
  const cfg = {
    low:    { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.25)",  label: "Leve"   },
    medium: { color: "#f97316", bg: "rgba(249,115,22,0.1)",  border: "rgba(249,115,22,0.25)",  label: "Medio"  },
    high:   { color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.25)",   label: "Alto"   },
  }[level] || { color: "#9ca3af", bg: "rgba(156,163,175,0.1)", border: "rgba(156,163,175,0.2)", label: "?" }

  return (
    <span className="flex items-center justify-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
          style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
      ⚑ {count} {cfg.label}
    </span>
  )
}

// ── Modal de detalle de incidentes ────────────────────────────────────────────
const EVENT_LABELS: Record<string, string> = {
  fullscreen_exit:     "🖥 Salió de pantalla completa",
  window_blur:         "🪟 Perdió foco de ventana",
  tab_hidden:          "📑 Cambió de pestaña",
  copy_attempt:        "📋 Intentó copiar",
  paste_attempt:       "📋 Intentó pegar",
  cut_attempt:         "✂️ Intentó cortar",
  contextmenu_attempt: "🖱 Abrió menú contextual",
  blocked_shortcut:    "⌨️ Tecla bloqueada",
  print_attempt:       "🖨 Intentó imprimir",
  reload_attempt:      "🔄 Intentó recargar",
  drag_attempt:        "↔️ Intentó arrastrar texto",
}

function IncidentModal({ submission, examId, onClose }: {
  submission: any; examId: string; onClose: () => void
}) {
  const [incidents, setIncidents] = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    fetch(`/api/exam-security/event?examId=${examId}&submissionId=${submission.id}`)
      .then(r => r.json())
      .then(d => setIncidents(d.incidents || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [submission.id, examId])

  const SEV_COLOR: Record<string, string> = {
    high:   "#ef4444",
    medium: "#f97316",
    low:    "#fbbf24",
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
           style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)" }}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] flex-shrink-0">
          <div>
            <h3 className="text-white font-bold text-sm">Incidentes — {submission.student_name}</h3>
            <p className="text-gray-500 text-xs">{submission.student_course} · {incidents.length} evento{incidents.length !== 1 ? "s" : ""} registrado{incidents.length !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 rounded-full border-2 border-white/10 border-t-red-400 animate-spin" />
            </div>
          ) : incidents.length === 0 ? (
            <div className="text-center py-8">
              <Shield size={28} className="text-gray-700 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Sin incidentes registrados</p>
            </div>
          ) : (
            <div className="space-y-2">
              {incidents.map((inc, i) => (
                <div key={inc.id || i} className="flex items-start gap-3 px-3 py-2.5 rounded-xl border"
                     style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.06)" }}>
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                       style={{ background: SEV_COLOR[inc.severity] || "#9ca3af" }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-gray-200 text-xs font-medium">
                        #{inc.incident_number} — {EVENT_LABELS[inc.event_type] || inc.event_type}
                      </p>
                      <span className="text-gray-600 text-[10px] flex-shrink-0 flex items-center gap-1">
                        <Clock size={9} />
                        {new Date(inc.created_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {inc.question_index != null && (
                        <span className="text-gray-600 text-[10px]">Pregunta {inc.question_index + 1}</span>
                      )}
                      {inc.client_time_left != null && (
                        <span className="text-gray-600 text-[10px]">
                          {Math.floor(inc.client_time_left / 60)}:{String(inc.client_time_left % 60).padStart(2, "0")} restantes
                        </span>
                      )}
                      {inc.event_detail && (
                        <span className="text-gray-600 text-[10px] font-mono">{inc.event_detail}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ResultadosExamenPage() {
  const params = useParams()
  const examId = params.id as string
  const [user, setUser] = useState<any>(null)
  const [exam, setExam] = useState<any>(null)
  const [submissions, setSubmissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [incidentSub, setIncidentSub] = useState<any>(null)  // submission seleccionada para modal
  const supabase = createClient()
  const router = useRouter()

  const fetchData = async () => {
    const res = await fetch(`/api/agents/examen-docente?examId=${examId}`)
    const data = await res.json()
    if (data.exam) setExam(data.exam)
    if (data.submissions) setSubmissions(data.submissions)
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/login")
      else setUser(user)
    })
    fetchData().then(() => setLoading(false))
    // Auto-refresh cada 15 segundos
    const interval = setInterval(() => { setRefreshing(true); fetchData().then(() => setRefreshing(false)) }, 15000)
    return () => clearInterval(interval)
  }, [examId])

  const toggleStatus = async () => {
    if (!exam || !user) return
    const action = exam.status === "active" ? "close" : "reopen"
    await fetch("/api/agents/examen-docente", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, examId, teacherId: user.id }),
    })
    fetchData()
  }

  // ── Stats ──
  const totalStudents = submissions.length
  const avgGrade = totalStudents > 0 ? submissions.reduce((a, s) => a + s.grade, 0) / totalStudents : 0
  const avgScore = totalStudents > 0 ? submissions.reduce((a, s) => a + s.score, 0) / totalStudents : 0
  const passCount = submissions.filter(s => s.grade >= 4.0).length
  const failCount = totalStudents - passCount
  const maxGrade = totalStudents > 0 ? Math.max(...submissions.map(s => s.grade)) : 0
  const minGrade = totalStudents > 0 ? Math.min(...submissions.map(s => s.grade)) : 0

  // Distribución de notas
  const dist = { "7.0-6.0": 0, "5.9-5.0": 0, "4.9-4.0": 0, "3.9-3.0": 0, "2.9-1.0": 0 }
  submissions.forEach(s => {
    if (s.grade >= 6.0) dist["7.0-6.0"]++
    else if (s.grade >= 5.0) dist["5.9-5.0"]++
    else if (s.grade >= 4.0) dist["4.9-4.0"]++
    else if (s.grade >= 3.0) dist["3.9-3.0"]++
    else dist["2.9-1.0"]++
  })

  // ── Export Excel ──
  const exportExcel = async () => {
    const XLSX = await import("xlsx")
    const rows = submissions.map((s, i) => ({
      "#": i + 1,
      "Nombre": s.student_name,
      "Curso": s.student_course,
      "RUT": s.student_rut || "-",
      "Correctas": s.correct_count,
      "Total": s.total_questions,
      "Porcentaje": `${Math.round(s.score)}%`,
      "Nota": s.grade,
      "Tiempo (min)": s.time_spent ? Math.round(s.time_spent / 60) : "-",
      "Fecha": new Date(s.submitted_at).toLocaleString("es-CL"),
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    ws["!cols"] = [{ wch: 4 }, { wch: 25 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 6 }, { wch: 10 }, { wch: 6 }, { wch: 12 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, ws, "Resultados")

    // Hoja de estadísticas
    const statsRows = [
      { Estadística: "Total alumnos", Valor: totalStudents },
      { Estadística: "Promedio nota", Valor: avgGrade.toFixed(1) },
      { Estadística: "Promedio %", Valor: `${Math.round(avgScore)}%` },
      { Estadística: "Aprobados", Valor: passCount },
      { Estadística: "Reprobados", Valor: failCount },
      { Estadística: "Nota máxima", Valor: maxGrade },
      { Estadística: "Nota mínima", Valor: minGrade },
      { Estadística: "% Aprobación", Valor: `${totalStudents > 0 ? Math.round((passCount / totalStudents) * 100) : 0}%` },
    ]
    const ws2 = XLSX.utils.json_to_sheet(statsRows)
    XLSX.utils.book_append_sheet(wb, ws2, "Estadísticas")

    XLSX.writeFile(wb, `${exam?.title || "examen"}-resultados.xlsx`)
  }

  // ── Export PDF ──
  const exportPDF = async () => {
    const { jsPDF } = await import("jspdf")
    const pdf = new jsPDF()
    const margin = 15
    let y = margin

    // Header
    pdf.setFillColor(59, 130, 246)
    pdf.rect(0, 0, 210, 30, "F")
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(16)
    pdf.setFont("helvetica", "bold")
    pdf.text(exam?.title || "Resultados", margin, 14)
    pdf.setFontSize(10)
    pdf.setFont("helvetica", "normal")
    pdf.text(`${exam?.topic || ""} | ${totalStudents} alumnos | ${new Date().toLocaleDateString("es-CL")}`, margin, 23)
    pdf.setTextColor(0, 0, 0)
    y = 38

    // Stats
    pdf.setFontSize(11)
    pdf.setFont("helvetica", "bold")
    pdf.text("Resumen", margin, y); y += 7
    pdf.setFontSize(9)
    pdf.setFont("helvetica", "normal")
    const stats = [
      `Promedio: ${avgGrade.toFixed(1)} (${Math.round(avgScore)}%)`,
      `Aprobados: ${passCount} (${totalStudents > 0 ? Math.round((passCount / totalStudents) * 100) : 0}%)`,
      `Reprobados: ${failCount}`,
      `Nota max: ${maxGrade} | Nota min: ${minGrade}`,
    ]
    stats.forEach(s => { pdf.text(s, margin, y); y += 5 })
    y += 5

    // Table header
    pdf.setFillColor(240, 240, 245)
    pdf.rect(margin, y - 3, 180, 7, "F")
    pdf.setFontSize(8)
    pdf.setFont("helvetica", "bold")
    const cols = [margin, margin + 6, margin + 55, margin + 80, margin + 100, margin + 120, margin + 140, margin + 160]
    const headers = ["#", "Nombre", "Curso", "RUT", "Correctas", "%", "Nota", "Tiempo"]
    headers.forEach((h, i) => pdf.text(h, cols[i], y))
    y += 7

    // Table rows
    pdf.setFont("helvetica", "normal")
    submissions.forEach((s, i) => {
      if (y > 275) { pdf.addPage(); y = margin }
      if (s.grade < 4.0) { pdf.setTextColor(200, 50, 50) } else { pdf.setTextColor(0, 0, 0) }
      const row = [
        String(i + 1),
        s.student_name.substring(0, 25),
        s.student_course,
        s.student_rut || "-",
        `${s.correct_count}/${s.total_questions}`,
        `${Math.round(s.score)}%`,
        String(s.grade),
        s.time_spent ? `${Math.round(s.time_spent / 60)}m` : "-",
      ]
      row.forEach((cell, j) => pdf.text(cell, cols[j], y))
      y += 5
    })

    // Footer
    pdf.setTextColor(150, 150, 150)
    pdf.setFontSize(7)
    pdf.text("Generado por EduAI Platform", margin, 290)

    pdf.save(`${exam?.title || "examen"}-resultados.pdf`)
  }

  const examUrl = exam ? `${window.location.origin}/examen/p/${exam.code}` : ""

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-blue-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex flex-wrap items-start gap-3 mb-6">
          <Link href="/examen/docente" className="text-gray-500 hover:text-white mt-1">←</Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-white truncate">{exam?.title}</h1>
            <p className="text-gray-500 text-xs mt-0.5">
              {exam?.topic} • Código: <span className="font-mono text-blue-400">{exam?.code}</span>
              {refreshing && <span className="ml-2 text-blue-400 animate-pulse">actualizando...</span>}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={toggleStatus}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                exam?.status === "active"
                  ? "bg-red-500/10 border-red-500/30 text-red-400"
                  : "bg-green-500/10 border-green-500/30 text-green-400"
              }`}>
              {exam?.status === "active" ? "🔒 Cerrar" : "🔓 Reabrir"}
            </button>
            <button onClick={() => navigator.clipboard?.writeText(examUrl)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-500/10 border border-blue-500/30 text-blue-400">
              📋 Link
            </button>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Alumnos", value: totalStudents, color: "text-blue-400" },
            { label: "Promedio", value: avgGrade.toFixed(1), color: avgGrade >= 4.0 ? "text-green-400" : "text-red-400" },
            { label: "Aprobados", value: `${passCount} (${totalStudents > 0 ? Math.round((passCount / totalStudents) * 100) : 0}%)`, color: "text-green-400" },
            { label: "Reprobados", value: failCount, color: "text-red-400" },
          ].map(s => (
            <div key={s.label} className="bg-gray-900/60 border border-white/5 rounded-2xl p-3">
              <p className="text-gray-600 text-[10px]">{s.label}</p>
              <p className={`font-bold text-lg ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Distribution */}
        {totalStudents > 0 && (
          <div className="bg-gray-900/60 border border-white/5 rounded-2xl p-4 mb-6">
            <h3 className="text-xs font-semibold text-gray-400 mb-3">DISTRIBUCIÓN DE NOTAS</h3>
            <div className="space-y-2">
              {Object.entries(dist).map(([range, count]) => (
                <div key={range} className="flex items-center gap-3">
                  <span className="text-gray-500 text-xs w-14">{range}</span>
                  <div className="flex-1 h-5 bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${
                      range.startsWith("7") || range.startsWith("5.9") || range.startsWith("4.9")
                        ? "bg-green-500/60" : "bg-red-500/60"
                    }`} style={{ width: `${totalStudents > 0 ? (count / totalStudents) * 100 : 0}%` }} />
                  </div>
                  <span className="text-gray-400 text-xs w-8 text-right">{count}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-3 text-[10px] text-gray-600">
              <span>Nota max: {maxGrade}</span>
              <span>Nota min: {minGrade}</span>
              <span>Promedio: {avgGrade.toFixed(1)}</span>
            </div>
          </div>
        )}

        {/* Export buttons */}
        <div className="flex gap-2 mb-4">
          <button onClick={exportExcel} disabled={totalStudents === 0}
            className="px-4 py-2 rounded-xl bg-green-600/20 border border-green-500/30 text-green-400 text-xs font-semibold disabled:opacity-30">
            📊 Descargar Excel
          </button>
          <button onClick={exportPDF} disabled={totalStudents === 0}
            className="px-4 py-2 rounded-xl bg-red-600/20 border border-red-500/30 text-red-400 text-xs font-semibold disabled:opacity-30">
            📄 Descargar PDF
          </button>
        </div>

        {/* Table */}
        {totalStudents === 0 ? (
          <div className="text-center py-12 bg-white/[0.02] rounded-2xl border border-white/[0.06]">
            <div className="text-4xl mb-3">⏳</div>
            <h3 className="text-white font-bold mb-1">Esperando alumnos...</h3>
            <p className="text-gray-500 text-sm mb-3">Comparte el link para que tus estudiantes rindan el examen</p>
            <p className="text-blue-400 text-xs font-mono">{examUrl}</p>
            <p className="text-gray-600 text-xs mt-2">La tabla se actualiza automáticamente cada 15 segundos</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-2 px-2 text-gray-500 text-xs font-semibold">#</th>
                  <th className="text-left py-2 px-2 text-gray-500 text-xs font-semibold">Nombre</th>
                  <th className="text-left py-2 px-2 text-gray-500 text-xs font-semibold">Curso</th>
                  <th className="text-left py-2 px-2 text-gray-500 text-xs font-semibold">RUT</th>
                  <th className="text-center py-2 px-2 text-gray-500 text-xs font-semibold">Correctas</th>
                  <th className="text-center py-2 px-2 text-gray-500 text-xs font-semibold">%</th>
                  <th className="text-center py-2 px-2 text-gray-500 text-xs font-semibold">Nota</th>
                  <th className="text-center py-2 px-2 text-gray-500 text-xs font-semibold">Tiempo</th>
                  <th className="text-center py-2 px-2 text-gray-500 text-xs font-semibold">Incidentes</th>
                  <th className="text-right py-2 px-2 text-gray-500 text-xs font-semibold">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s, i) => (
                  <tr key={s.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 px-2 text-gray-600">{i + 1}</td>
                    <td className="py-2.5 px-2 text-gray-200 font-medium">{s.student_name}</td>
                    <td className="py-2.5 px-2 text-gray-400">{s.student_course}</td>
                    <td className="py-2.5 px-2 text-gray-500 font-mono text-xs">{s.student_rut || "—"}</td>
                    <td className="py-2.5 px-2 text-center text-gray-300">{s.correct_count}/{s.total_questions}</td>
                    <td className="py-2.5 px-2 text-center">
                      <span className={`${s.score >= 60 ? "text-green-400" : "text-red-400"}`}>
                        {Math.round(s.score)}%
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span className={`font-bold text-sm px-2 py-0.5 rounded-lg ${
                        s.grade >= 6.0 ? "bg-green-500/10 text-green-400" :
                        s.grade >= 4.0 ? "bg-blue-500/10 text-blue-400" :
                        "bg-red-500/10 text-red-400"
                      }`}>
                        {s.grade}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center text-gray-500 text-xs">
                      {s.time_spent ? `${Math.round(s.time_spent / 60)}m` : "—"}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      {(s.incident_count ?? 0) > 0 ? (
                        <button onClick={() => setIncidentSub(s)}
                          className="flex items-center justify-center mx-auto">
                          <RiskBadge level={s.incident_level || "clean"} count={s.incident_count || 0} />
                        </button>
                      ) : (
                        <span className="text-gray-700 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-right text-gray-600 text-xs">
                      {new Date(s.submitted_at).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        )}

      </div>

      {/* Modal de incidentes */}
      {incidentSub && (
        <IncidentModal
          submission={incidentSub}
          examId={examId}
          onClose={() => setIncidentSub(null)}
        />
      )}
    </div>
  )
}
