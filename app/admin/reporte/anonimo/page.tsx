"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Layers3,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react"

type ModuleRow = {
  key: string
  name: string
  category: string
  href: string
  icon: string
  description: string
  agentKey: string | null
  agentName: string | null
  events: number
  pageViews: number
  actions: number
  uniqueUsers: number
  successes: number
  errors: number
  successRate: number
  avgLatencyMs: number
  inputTokens: number
  outputTokens: number
  estimatedCost: number
  storedRecords: number
  lastActivity: string | null
}

type AgentRow = {
  key: string
  name: string
  modules: string[]
  events: number
  pageViews: number
  actions: number
  uniqueUsers: number
  successes: number
  errors: number
  successRate: number
  avgLatencyMs: number
  inputTokens: number
  outputTokens: number
  estimatedCost: number
  storedRecords: number
  lastActivity: string | null
}

type AnalyticsReport = {
  generatedAt: string
  period: { key: string; days: number | null; label: string }
  overview: {
    totalUsers: number
    activeUsers: number
    totalEvents: number
    activeModules: number
    totalModules: number
    activeAgents: number
    totalAgents: number
    successes: number
    errors: number
    successRate: number
    avgLatencyMs: number
    inputTokens: number
    outputTokens: number
    estimatedCost: number
    totalStoredRecords: number
  }
  moduleRows: ModuleRow[]
  agentRows: AgentRow[]
  activityByDay: Array<{ date: string; events: number; uniqueUsers: number; errors: number }>
  eventTypes: Array<{ type: string; count: number }>
  recentErrors: Array<{
    moduleKey: string
    moduleName: string
    agentName: string | null
    eventType: string
    errorCode: string | null
    createdAt: string
  }>
}

type AnonymousStudent = {
  anonymousId: string
  events: number
  pageViews: number
  actions: number
  generations: number
  exports: number
  errors: number
  successes: number
  successRate: number
  avgLatencyMs: number
  inputTokens: number
  outputTokens: number
  estimatedCost: number
  modules: string[]
  agents: string[]
  firstActivity: string | null
  lastActivity: string | null
  examSubmissions: number
  averageExamScore: number | null
  minimumExamScore: number | null
  maximumExamScore: number | null
}

type AnonymousReport = {
  generatedAt: string
  period: { key: string; days: number | null; label: string }
  methodology: {
    anonymization: string
    excludedFields: string[]
    caution: string
  }
  overview: {
    registeredProfiles: number
    anonymousStudents: number
    usageEvents: number
    examSubmissions: number
    errors: number
  }
  students: AnonymousStudent[]
  errors: Array<{
    moduleKey: string
    moduleName: string
    agentName: string | null
    errorCode: string | null
    createdAt: string
  }>
  coverage: {
    usageTrackingAvailable: boolean
    examSubmissionsAvailable: boolean
    usageError: string | null
    submissionsError: string | null
    usageLimitReached: boolean
    submissionLimitReached: boolean
  }
}

const PERIODS = [
  { value: "7", label: "7 días" },
  { value: "30", label: "30 días" },
  { value: "90", label: "90 días" },
  { value: "365", label: "1 año" },
  { value: "all", label: "Todo" },
]

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("es-CL").format(Number(value || 0))
}

function formatDate(value: string | null) {
  if (!value) return "Sin actividad"
  return new Date(value).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatCost(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value > 0 && value < 1 ? 4 : 2,
    maximumFractionDigits: 6,
  }).format(value || 0)
}

function safeFilenameDate() {
  return new Date().toISOString().slice(0, 10)
}

export default function AnonymousAdminReportPage() {
  const [period, setPeriod] = useState("30")
  const [analytics, setAnalytics] = useState<AnalyticsReport | null>(null)
  const [anonymous, setAnonymous] = useState<AnonymousReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")

  const loadReport = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [analyticsResponse, anonymousResponse] = await Promise.all([
        fetch(`/api/admin?action=analytics&period=${period}`, { cache: "no-store" }),
        fetch(`/api/admin/anonymous-report?period=${period}`, { cache: "no-store" }),
      ])
      const [analyticsData, anonymousData] = await Promise.all([
        analyticsResponse.json(),
        anonymousResponse.json(),
      ])
      if (!analyticsResponse.ok) throw new Error(analyticsData.error || "No se pudo cargar la analítica")
      if (!anonymousResponse.ok) throw new Error(anonymousData.error || "No se pudo crear la vista anónima")
      setAnalytics(analyticsData)
      setAnonymous(anonymousData)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el reporte")
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  const filteredStudents = useMemo(() => {
    if (!anonymous) return []
    const needle = search.trim().toLowerCase()
    if (!needle) return anonymous.students
    return anonymous.students.filter(student => [
      student.anonymousId,
      ...student.modules,
      ...student.agents,
    ].some(value => value.toLowerCase().includes(needle)))
  }, [anonymous, search])

  async function downloadExcel() {
    if (!analytics || !anonymous) return
    setExporting("xlsx")
    try {
      const XLSX = await import("xlsx")
      const workbook = XLSX.utils.book_new()

      const summaryRows = [
        ["REPORTE ANÓNIMO DETALLADO DE EDUAI"],
        ["Generado", formatDate(anonymous.generatedAt)],
        ["Período", anonymous.period.label],
        ["Perfiles registrados", anonymous.overview.registeredProfiles],
        ["Estudiantes únicos anonimizados", anonymous.overview.anonymousStudents],
        ["Eventos de uso", anonymous.overview.usageEvents],
        ["Entregas de exámenes", anonymous.overview.examSubmissions],
        ["Módulos activos", `${analytics.overview.activeModules}/${analytics.overview.totalModules}`],
        ["Agentes activos", `${analytics.overview.activeAgents}/${analytics.overview.totalAgents}`],
        ["Recursos almacenados", analytics.overview.totalStoredRecords],
        ["Tasa de éxito", `${analytics.overview.successRate}%`],
        ["Errores", analytics.overview.errors],
        ["Tokens", analytics.overview.inputTokens + analytics.overview.outputTokens],
        ["Costo IA estimado USD", analytics.overview.estimatedCost],
      ]
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows)
      summarySheet["!cols"] = [{ wch: 34 }, { wch: 32 }]
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumen")

      const moduleSheet = XLSX.utils.json_to_sheet(analytics.moduleRows.map(row => ({
        Modulo: row.name,
        Categoria: row.category,
        Agente: row.agentName || "",
        Eventos: row.events,
        Visitas: row.pageViews,
        Acciones: row.actions,
        Usuarios_unicos: row.uniqueUsers,
        Exitos: row.successes,
        Errores: row.errors,
        Tasa_exito: row.successRate,
        Latencia_promedio_ms: row.avgLatencyMs,
        Tokens: row.inputTokens + row.outputTokens,
        Costo_estimado_USD: row.estimatedCost,
        Registros_almacenados: row.storedRecords,
        Ultima_actividad: row.lastActivity || "",
      })))
      moduleSheet["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 24 }, ...Array(12).fill({ wch: 17 })]
      XLSX.utils.book_append_sheet(workbook, moduleSheet, "Modulos")

      const agentSheet = XLSX.utils.json_to_sheet(analytics.agentRows.map(row => ({
        Agente: row.name,
        Modulos: row.modules.join(" | "),
        Eventos: row.events,
        Visitas: row.pageViews,
        Acciones: row.actions,
        Usuarios_unicos: row.uniqueUsers,
        Exitos: row.successes,
        Errores: row.errors,
        Tasa_exito: row.successRate,
        Latencia_promedio_ms: row.avgLatencyMs,
        Tokens: row.inputTokens + row.outputTokens,
        Costo_estimado_USD: row.estimatedCost,
        Registros_almacenados: row.storedRecords,
        Ultima_actividad: row.lastActivity || "",
      })))
      agentSheet["!cols"] = [{ wch: 28 }, { wch: 50 }, ...Array(12).fill({ wch: 17 })]
      XLSX.utils.book_append_sheet(workbook, agentSheet, "Agentes")

      const studentSheet = XLSX.utils.json_to_sheet(anonymous.students.map(student => ({
        Estudiante_anonimo: student.anonymousId,
        Modulos: student.modules.join(" | "),
        Agentes: student.agents.join(" | "),
        Eventos: student.events,
        Visitas: student.pageViews,
        Acciones: student.actions,
        Generaciones: student.generations,
        Exportaciones: student.exports,
        Exitos: student.successes,
        Errores: student.errors,
        Tasa_exito: student.successRate,
        Latencia_promedio_ms: student.avgLatencyMs,
        Tokens_entrada: student.inputTokens,
        Tokens_salida: student.outputTokens,
        Costo_estimado_USD: student.estimatedCost,
        Primera_actividad: student.firstActivity || "",
        Ultima_actividad: student.lastActivity || "",
        Entregas_examen: student.examSubmissions,
        Promedio_resultado_examen: student.averageExamScore ?? "",
        Resultado_minimo: student.minimumExamScore ?? "",
        Resultado_maximo: student.maximumExamScore ?? "",
      })))
      studentSheet["!cols"] = [{ wch: 20 }, { wch: 55 }, { wch: 45 }, ...Array(18).fill({ wch: 18 })]
      XLSX.utils.book_append_sheet(workbook, studentSheet, "Estudiantes anonimos")

      const examSheet = XLSX.utils.json_to_sheet(anonymous.students
        .filter(student => student.examSubmissions > 0)
        .map(student => ({
          Estudiante_anonimo: student.anonymousId,
          Entregas: student.examSubmissions,
          Promedio: student.averageExamScore ?? "",
          Minimo: student.minimumExamScore ?? "",
          Maximo: student.maximumExamScore ?? "",
          Ultima_actividad: student.lastActivity || "",
        })))
      examSheet["!cols"] = [{ wch: 20 }, ...Array(5).fill({ wch: 20 })]
      XLSX.utils.book_append_sheet(workbook, examSheet, "Examenes anonimos")

      const activitySheet = XLSX.utils.json_to_sheet(analytics.activityByDay.map(day => ({
        Fecha: day.date,
        Eventos: day.events,
        Estudiantes_unicos: day.uniqueUsers,
        Errores: day.errors,
      })))
      activitySheet["!cols"] = Array(4).fill({ wch: 22 })
      XLSX.utils.book_append_sheet(workbook, activitySheet, "Actividad diaria")

      const errorsSheet = XLSX.utils.json_to_sheet(anonymous.errors.map(item => ({
        Modulo: item.moduleName,
        Agente: item.agentName || "",
        Codigo_error: item.errorCode || "",
        Fecha: item.createdAt,
      })))
      errorsSheet["!cols"] = [{ wch: 28 }, { wch: 26 }, { wch: 30 }, { wch: 24 }]
      XLSX.utils.book_append_sheet(workbook, errorsSheet, "Errores depurados")

      const methodologySheet = XLSX.utils.aoa_to_sheet([
        ["METODOLOGÍA Y PRIVACIDAD"],
        ["Anonimización", anonymous.methodology.anonymization],
        ["Campos excluidos", anonymous.methodology.excludedFields.join(", ")],
        ["Advertencia", anonymous.methodology.caution],
        ["Tracking disponible", anonymous.coverage.usageTrackingAvailable ? "Sí" : "No"],
        ["Entregas disponibles", anonymous.coverage.examSubmissionsAvailable ? "Sí" : "No"],
        ["Límite de eventos alcanzado", anonymous.coverage.usageLimitReached ? "Sí" : "No"],
        ["Límite de entregas alcanzado", anonymous.coverage.submissionLimitReached ? "Sí" : "No"],
        ["Responsable", "Innova Space Edu SpA"],
      ])
      methodologySheet["!cols"] = [{ wch: 32 }, { wch: 110 }]
      XLSX.utils.book_append_sheet(workbook, methodologySheet, "Metodologia")

      XLSX.writeFile(workbook, `eduai-reporte-anonimo-${safeFilenameDate()}.xlsx`)
    } finally {
      setExporting(null)
    }
  }

  async function downloadPdf() {
    if (!analytics || !anonymous) return
    setExporting("pdf")
    try {
      const { jsPDF } = await import("jspdf")
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 12
      let y = 15

      function newPage(title?: string) {
        pdf.addPage("a4", "landscape")
        y = 15
        if (title) {
          pdf.setFontSize(15)
          pdf.setFont("helvetica", "bold")
          pdf.text(title, margin, y)
          y += 9
        }
      }

      function ensureSpace(height: number, title?: string) {
        if (y + height > pageHeight - 12) newPage(title)
      }

      function paragraph(text: string, maxWidth = pageWidth - margin * 2) {
        pdf.setFontSize(9)
        pdf.setFont("helvetica", "normal")
        const lines = pdf.splitTextToSize(text, maxWidth)
        ensureSpace(lines.length * 4.5)
        pdf.text(lines, margin, y)
        y += lines.length * 4.5 + 2
      }

      function table(headers: string[], rows: Array<Array<string | number>>, widths: number[], title: string) {
        const rowHeight = 7
        const drawHeader = () => {
          pdf.setFillColor(35, 54, 90)
          pdf.setTextColor(255, 255, 255)
          pdf.setFontSize(7)
          pdf.setFont("helvetica", "bold")
          let x = margin
          headers.forEach((header, index) => {
            pdf.rect(x, y, widths[index], rowHeight, "F")
            pdf.text(String(header).slice(0, 28), x + 1.5, y + 4.7)
            x += widths[index]
          })
          pdf.setTextColor(20, 25, 35)
          y += rowHeight
        }

        ensureSpace(18, title)
        pdf.setFontSize(13)
        pdf.setFont("helvetica", "bold")
        pdf.text(title, margin, y)
        y += 7
        drawHeader()

        rows.forEach((row, rowIndex) => {
          if (y + rowHeight > pageHeight - 12) {
            newPage(`${title} — continuación`)
            drawHeader()
          }
          pdf.setFillColor(rowIndex % 2 === 0 ? 246 : 238, rowIndex % 2 === 0 ? 248 : 242, 252)
          pdf.setFontSize(6.7)
          pdf.setFont("helvetica", "normal")
          let x = margin
          row.forEach((cell, index) => {
            pdf.rect(x, y, widths[index], rowHeight, "F")
            const text = String(cell ?? "")
            pdf.text(text.length > 32 ? `${text.slice(0, 29)}…` : text, x + 1.3, y + 4.6)
            x += widths[index]
          })
          y += rowHeight
        })
        y += 5
      }

      pdf.setFillColor(35, 54, 90)
      pdf.rect(0, 0, pageWidth, 42, "F")
      pdf.setTextColor(255, 255, 255)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(24)
      pdf.text("Reporte anónimo detallado de EduAI", margin, 20)
      pdf.setFontSize(11)
      pdf.setFont("helvetica", "normal")
      pdf.text(`Innova Space Edu SpA · ${anonymous.period.label}`, margin, 30)
      pdf.setTextColor(20, 25, 35)
      y = 52

      const summary = [
        `Estudiantes únicos anonimizados: ${formatNumber(anonymous.overview.anonymousStudents)}`,
        `Eventos: ${formatNumber(anonymous.overview.usageEvents)}`,
        `Entregas de exámenes: ${formatNumber(anonymous.overview.examSubmissions)}`,
        `Módulos activos: ${analytics.overview.activeModules}/${analytics.overview.totalModules}`,
        `Agentes activos: ${analytics.overview.activeAgents}/${analytics.overview.totalAgents}`,
        `Registros almacenados: ${formatNumber(analytics.overview.totalStoredRecords)}`,
        `Tasa de éxito: ${analytics.overview.successRate}%`,
      ]
      table(["Indicador", "Valor"], summary.map(item => {
        const [label, ...value] = item.split(":")
        return [label, value.join(":").trim()]
      }), [90, 70], "Resumen general")

      paragraph(`Metodología: ${anonymous.methodology.anonymization}. Campos excluidos: ${anonymous.methodology.excludedFields.join(", ")}.`)
      paragraph(anonymous.methodology.caution)

      table(
        ["Módulo", "Categoría", "Agente", "Eventos", "Usuarios", "Errores", "Registros"],
        analytics.moduleRows.map(row => [
          row.name,
          row.category,
          row.agentName || "—",
          row.events,
          row.uniqueUsers,
          row.errors,
          row.storedRecords,
        ]),
        [48, 30, 43, 22, 22, 20, 23],
        "Detalle por módulo",
      )

      table(
        ["Agente", "Módulos", "Eventos", "Usuarios", "Éxito", "Errores", "Costo USD"],
        analytics.agentRows.map(row => [
          row.name,
          row.modules.join(" · "),
          row.events,
          row.uniqueUsers,
          `${row.successRate}%`,
          row.errors,
          row.estimatedCost,
        ]),
        [48, 75, 22, 22, 20, 20, 27],
        "Detalle por agente",
      )

      table(
        ["Código", "Módulos", "Eventos", "Acciones", "Errores", "Entregas", "Promedio", "Última actividad"],
        anonymous.students.map(student => [
          student.anonymousId,
          student.modules.join(" · "),
          student.events,
          student.actions,
          student.errors,
          student.examSubmissions,
          student.averageExamScore ?? "—",
          formatDate(student.lastActivity),
        ]),
        [28, 78, 20, 20, 18, 20, 22, 47],
        "Dashboard anonimizado de estudiantes únicos",
      )

      const pages = pdf.getNumberOfPages()
      for (let page = 1; page <= pages; page += 1) {
        pdf.setPage(page)
        pdf.setFontSize(7)
        pdf.setTextColor(100, 110, 125)
        pdf.text(`EduAI · Reporte anónimo · Página ${page} de ${pages}`, margin, pageHeight - 6)
      }

      pdf.save(`eduai-reporte-anonimo-${safeFilenameDate()}.pdf`)
    } finally {
      setExporting(null)
    }
  }

  const agentDestination = useMemo(() => {
    const map = new Map<string, string>()
    analytics?.moduleRows.forEach(module => {
      if (module.agentName && !map.has(module.agentName)) map.set(module.agentName, module.href)
    })
    return map
  }, [analytics])

  return (
    <main className="min-h-screen bg-app text-main">
      <header className="sticky top-0 z-30 border-b border-soft bg-app/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-3 lg:px-6">
          <Link href="/admin/reporte" className="grid h-9 w-9 place-items-center rounded-xl border border-soft bg-card-soft-theme text-sub hover:text-main" aria-label="Volver">
            <ArrowLeft size={16} />
          </Link>
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-emerald-600 to-blue-600 text-white">
            <ShieldCheck size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold sm:text-base">Reporte anónimo detallado</h1>
            <p className="truncate text-[11px] text-muted2">PDF y Excel sin datos identificadores directos</p>
          </div>
          <select value={period} onChange={event => setPeriod(event.target.value)} className="rounded-xl border border-soft bg-card-soft-theme px-3 py-2 text-xs text-sub">
            {PERIODS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <button onClick={loadReport} title="Actualizar" className="grid h-9 w-9 place-items-center rounded-xl border border-soft bg-card-soft-theme text-sub hover:text-main">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-6 lg:px-6">
        {loading && !analytics && (
          <div className="flex min-h-[55vh] flex-col items-center justify-center gap-3">
            <Loader2 size={34} className="animate-spin text-emerald-500" />
            <p className="text-sm text-muted2">Anonimizando y sincronizando los datos…</p>
          </div>
        )}

        {error && (
          <section className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-red-500">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} />
              <div className="flex-1">
                <p className="font-semibold">No se pudo construir el reporte</p>
                <p className="mt-1 text-sm">{error}</p>
              </div>
              <button onClick={loadReport} className="rounded-xl border border-red-500/20 px-3 py-1.5 text-xs">Reintentar</button>
            </div>
          </section>
        )}

        {analytics && anonymous && (
          <>
            <section className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-600">
                    <ShieldCheck size={12} /> Exportación protegida
                  </div>
                  <h2 className="mt-3 text-2xl font-bold">Dashboard anonimizado de estudiantes únicos</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-sub">
                    Los códigos EST se generan nuevamente para cada reporte. No se incluyen nombres, correos, RUT, UUID, IP, respuestas, prompts ni datos sensibles.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={downloadExcel} disabled={Boolean(exporting)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                    {exporting === "xlsx" ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
                    Descargar Excel
                  </button>
                  <button onClick={downloadPdf} disabled={Boolean(exporting)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                    {exporting === "pdf" ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                    Descargar PDF
                  </button>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              {[
                { label: "Perfiles", value: anonymous.overview.registeredProfiles, detail: "registrados", icon: Users, color: "#3b82f6" },
                { label: "Estudiantes", value: anonymous.overview.anonymousStudents, detail: "únicos anonimizados", icon: ShieldCheck, color: "#10b981" },
                { label: "Eventos", value: anonymous.overview.usageEvents, detail: "uso registrado", icon: CheckCircle2, color: "#8b5cf6" },
                { label: "Entregas", value: anonymous.overview.examSubmissions, detail: "de exámenes", icon: FileText, color: "#f59e0b" },
                { label: "Módulos", value: `${analytics.overview.activeModules}/${analytics.overview.totalModules}`, detail: "con datos o uso", icon: Layers3, color: "#06b6d4" },
                { label: "Agentes", value: `${analytics.overview.activeAgents}/${analytics.overview.totalAgents}`, detail: "con datos o uso", icon: Bot, color: "#ec4899" },
              ].map(card => {
                const Icon = card.icon
                return (
                  <article key={card.label} className="rounded-2xl border p-4" style={{ borderColor: `${card.color}28`, background: `${card.color}08` }}>
                    <Icon size={17} style={{ color: card.color }} />
                    <p className="mt-3 text-xl font-bold">{formatNumber(typeof card.value === "number" ? card.value : 0) || card.value}</p>
                    {typeof card.value === "string" && <p className="-mt-5 text-xl font-bold">{card.value}</p>}
                    <p className="mt-2 text-[11px] font-semibold text-sub">{card.label}</p>
                    <p className="text-[10px] text-muted2">{card.detail}</p>
                  </article>
                )
              })}
            </section>

            {(!anonymous.coverage.usageTrackingAvailable || !anonymous.coverage.examSubmissionsAvailable || anonymous.coverage.usageLimitReached || anonymous.coverage.submissionLimitReached) && (
              <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-6 text-sub">
                <p className="font-semibold text-amber-600">Cobertura parcial</p>
                {!anonymous.coverage.usageTrackingAvailable && <p>La tabla de eventos de uso no está disponible.</p>}
                {!anonymous.coverage.examSubmissionsAvailable && <p>La tabla de entregas de exámenes no está disponible.</p>}
                {anonymous.coverage.usageLimitReached && <p>Se alcanzó el límite de 10.000 eventos para esta exportación.</p>}
                {anonymous.coverage.submissionLimitReached && <p>Se alcanzó el límite de 10.000 entregas para esta exportación.</p>}
              </section>
            )}

            <section className="grid gap-4 xl:grid-cols-2">
              <article className="rounded-2xl border border-soft bg-card-soft-theme p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold">Módulos sincronizados</h3>
                    <p className="mt-1 text-xs text-muted2">Presiona una ventana para abrir el módulo correspondiente.</p>
                  </div>
                  <Layers3 size={18} className="text-cyan-500" />
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {analytics.moduleRows.slice(0, 12).map(module => (
                    <Link key={module.key} href={module.href} className="group flex items-center gap-3 rounded-xl border border-soft bg-app/40 p-3 transition hover:border-cyan-500/30 hover:bg-cyan-500/5">
                      <span className="text-xl">{module.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold">{module.name}</span>
                        <span className="mt-0.5 block text-[10px] text-muted2">{module.events} eventos · {module.storedRecords} registros</span>
                      </span>
                      <Download size={13} className="-rotate-90 text-muted2 group-hover:text-cyan-500" />
                    </Link>
                  ))}
                </div>
              </article>

              <article className="rounded-2xl border border-soft bg-card-soft-theme p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold">Agentes sincronizados</h3>
                    <p className="mt-1 text-xs text-muted2">Cada agente redirige a su módulo principal.</p>
                  </div>
                  <Bot size={18} className="text-pink-500" />
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {analytics.agentRows.slice(0, 12).map(agent => {
                    const href = agentDestination.get(agent.name) || "/agentes"
                    return (
                      <Link key={agent.key} href={href} className="group flex items-center gap-3 rounded-xl border border-soft bg-app/40 p-3 transition hover:border-pink-500/30 hover:bg-pink-500/5">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-pink-500/10 text-pink-500"><Bot size={14} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold">{agent.name}</span>
                          <span className="mt-0.5 block truncate text-[10px] text-muted2">{agent.events} eventos · {agent.uniqueUsers} usuarios</span>
                        </span>
                        <Download size={13} className="-rotate-90 text-muted2 group-hover:text-pink-500" />
                      </Link>
                    )
                  })}
                </div>
              </article>
            </section>

            <section className="rounded-2xl border border-soft bg-card-soft-theme p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-bold">Detalle por estudiante anónimo</h3>
                  <p className="mt-1 text-xs text-muted2">Actividad y resultados sin identificadores directos.</p>
                </div>
                <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar código, módulo o agente" className="w-full rounded-xl border border-soft bg-app px-3 py-2 text-xs outline-none sm:w-72" />
              </div>
              <div className="mt-4 overflow-x-auto rounded-xl border border-soft">
                <table className="min-w-[1350px] w-full">
                  <thead>
                    <tr className="border-b border-soft text-left text-[10px] uppercase tracking-wider text-muted2">
                      <th className="px-4 py-3">Código</th>
                      <th className="px-3 py-3">Módulos</th>
                      <th className="px-3 py-3">Agentes</th>
                      <th className="px-3 py-3 text-right">Eventos</th>
                      <th className="px-3 py-3 text-right">Acciones</th>
                      <th className="px-3 py-3 text-right">Generaciones</th>
                      <th className="px-3 py-3 text-right">Errores</th>
                      <th className="px-3 py-3 text-right">Éxito</th>
                      <th className="px-3 py-3 text-right">Entregas</th>
                      <th className="px-3 py-3 text-right">Promedio</th>
                      <th className="px-3 py-3">Última actividad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map(student => (
                      <tr key={student.anonymousId} className="border-b border-soft/70 hover:bg-app/40">
                        <td className="px-4 py-3 text-xs font-bold text-emerald-600">{student.anonymousId}</td>
                        <td className="max-w-72 px-3 py-3 text-[10px] text-sub">{student.modules.join(" · ") || "—"}</td>
                        <td className="max-w-64 px-3 py-3 text-[10px] text-sub">{student.agents.join(" · ") || "—"}</td>
                        <td className="px-3 py-3 text-right text-xs font-semibold">{formatNumber(student.events)}</td>
                        <td className="px-3 py-3 text-right text-xs">{formatNumber(student.actions)}</td>
                        <td className="px-3 py-3 text-right text-xs">{formatNumber(student.generations)}</td>
                        <td className="px-3 py-3 text-right text-xs font-semibold text-red-500">{formatNumber(student.errors)}</td>
                        <td className="px-3 py-3 text-right text-xs text-emerald-600">{student.events ? `${student.successRate}%` : "—"}</td>
                        <td className="px-3 py-3 text-right text-xs">{formatNumber(student.examSubmissions)}</td>
                        <td className="px-3 py-3 text-right text-xs">{student.averageExamScore ?? "—"}</td>
                        <td className="px-3 py-3 text-[10px] text-muted2">{formatDate(student.lastActivity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-soft bg-card-soft-theme p-5 text-xs leading-6 text-sub">
              <h3 className="font-bold text-main">Metodología de protección</h3>
              <p className="mt-2"><strong>Anonimización:</strong> {anonymous.methodology.anonymization}.</p>
              <p><strong>Campos excluidos:</strong> {anonymous.methodology.excludedFields.join(", ")}.</p>
              <p><strong>Advertencia:</strong> {anonymous.methodology.caution}</p>
              <p className="mt-2 text-muted2">Costo IA estimado del período: {formatCost(analytics.overview.estimatedCost)}.</p>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
