"use client"

import { useEffect } from "react"

const HEADER_ATTR = "data-eduai-course-group-header"
const GROUP_ATTR = "data-eduai-course-group"
const PATCHED_ATTR = "data-eduai-results-course-groups"

function path() {
  return typeof window === "undefined" ? "" : window.location.pathname
}

function resultsPageKey() {
  const match = path().match(/^\/examen\/resultados\/([^/?#]+)/)
  return match ? `eduai_results_courses_open_${decodeURIComponent(match[1])}` : ""
}

function text(value: Element | null | undefined) {
  return (value?.textContent || "").replace(/\s+/g, " ").trim()
}

function getOpenState(): Record<string, boolean> {
  const key = resultsPageKey()
  if (!key) return {}
  try {
    return JSON.parse(sessionStorage.getItem(key) || "{}") || {}
  } catch {
    return {}
  }
}

function setCourseOpen(course: string, open: boolean) {
  const key = resultsPageKey()
  if (!key) return
  const current = getOpenState()
  current[course] = open
  sessionStorage.setItem(key, JSON.stringify(current))
}

function parseNumber(value: string) {
  const cleaned = value.replace("%", "").replace(",", ".").replace(/[^0-9.-]/g, "")
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function findResultsTable() {
  const tables = Array.from(document.querySelectorAll("table"))
  return tables.find((table) => {
    const headers = Array.from(table.querySelectorAll("thead th")).map((th) => text(th).toLowerCase())
    return headers.includes("estudiante") && headers.includes("curso") && headers.includes("nota")
  }) as HTMLTableElement | undefined
}

function buildSignature(rows: HTMLTableRowElement[], courseIndex: number) {
  return rows
    .map((row) => `${text(row.cells[courseIndex])}|${text(row.cells[0])}`)
    .join("||")
}

function applyVisibility(tbody: HTMLTableSectionElement, groups: Record<string, HTMLTableRowElement[]>) {
  const openState = getOpenState()

  Object.entries(groups).forEach(([course, rows]) => {
    const open = openState[course] === true
    rows.forEach((row) => {
      row.hidden = !open
      row.setAttribute(GROUP_ATTR, course)
    })

    const header = tbody.querySelector(`tr[${HEADER_ATTR}="${CSS.escape(course)}"]`) as HTMLTableRowElement | null
    const button = header?.querySelector("button[data-eduai-course-toggle]") as HTMLButtonElement | null
    const icon = header?.querySelector("[data-eduai-course-icon]") as HTMLElement | null
    const label = header?.querySelector("[data-eduai-course-label]") as HTMLElement | null
    if (button) button.setAttribute("aria-expanded", String(open))
    if (icon) icon.textContent = open ? "▼" : "▶"
    if (label) label.textContent = open ? "Cerrar resultados" : "Abrir resultados"
  })
}

function makeGroupHeader(
  course: string,
  rows: HTMLTableRowElement[],
  colSpan: number,
  stats: { avgGrade: number; avgScore: number; reviewed: number; pending: number },
) {
  const open = getOpenState()[course] === true
  const header = document.createElement("tr")
  header.setAttribute(HEADER_ATTR, course)
  header.className = "border-t border-soft"

  const cell = document.createElement("td")
  cell.colSpan = colSpan
  cell.className = "px-4 py-3"
  cell.style.background = "rgba(16,185,129,0.08)"

  const wrapper = document.createElement("div")
  wrapper.className = "flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-white/80 px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"

  const left = document.createElement("div")
  left.className = "min-w-0"
  left.innerHTML = `
    <p class="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-600">Curso</p>
    <div class="mt-1 flex flex-wrap items-center gap-2">
      <span class="text-lg font-black text-slate-900">${course}</span>
      <span class="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-black text-emerald-700">${rows.length} estudiante${rows.length === 1 ? "" : "s"}</span>
    </div>
  `

  const metrics = document.createElement("div")
  metrics.className = "grid grid-cols-2 gap-2 text-xs sm:flex sm:items-center"
  metrics.innerHTML = `
    <span class="rounded-xl bg-white px-3 py-2 font-bold text-slate-700 shadow-sm">Prom. nota: <b class="text-slate-950">${stats.avgGrade.toFixed(1)}</b></span>
    <span class="rounded-xl bg-white px-3 py-2 font-bold text-slate-700 shadow-sm">Prom. logro: <b class="text-slate-950">${Math.round(stats.avgScore)}%</b></span>
    <span class="rounded-xl bg-white px-3 py-2 font-bold text-slate-700 shadow-sm">Revisados: <b class="text-slate-950">${stats.reviewed}</b></span>
    <span class="rounded-xl bg-white px-3 py-2 font-bold text-slate-700 shadow-sm">Pendientes: <b class="text-slate-950">${stats.pending}</b></span>
  `

  const button = document.createElement("button")
  button.type = "button"
  button.setAttribute("data-eduai-course-toggle", "true")
  button.setAttribute("aria-expanded", String(open))
  button.className = "flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700"
  button.innerHTML = `<span data-eduai-course-icon>${open ? "▼" : "▶"}</span><span data-eduai-course-label>${open ? "Cerrar resultados" : "Abrir resultados"}</span>`
  button.addEventListener("click", () => {
    const next = getOpenState()[course] !== true
    setCourseOpen(course, next)
    const groupedRows = Array.from(document.querySelectorAll(`tr[${GROUP_ATTR}="${CSS.escape(course)}"]`)) as HTMLTableRowElement[]
    groupedRows.forEach((row) => (row.hidden = !next))
    button.setAttribute("aria-expanded", String(next))
    const icon = button.querySelector("[data-eduai-course-icon]") as HTMLElement | null
    const label = button.querySelector("[data-eduai-course-label]") as HTMLElement | null
    if (icon) icon.textContent = next ? "▼" : "▶"
    if (label) label.textContent = next ? "Cerrar resultados" : "Abrir resultados"
  })

  wrapper.append(left, metrics, button)
  cell.appendChild(wrapper)
  header.appendChild(cell)
  return header
}

function applyCourseGroups() {
  if (!path().startsWith("/examen/resultados/")) return

  const table = findResultsTable()
  const tbody = table?.querySelector("tbody") as HTMLTableSectionElement | null
  if (!table || !tbody) return

  const headers = Array.from(table.querySelectorAll("thead th")).map((th) => text(th).toLowerCase())
  const courseIndex = headers.findIndex((value) => value === "curso")
  const gradeIndex = headers.findIndex((value) => value === "nota")
  const scoreIndex = headers.findIndex((value) => value === "logro")
  const reviewIndex = headers.findIndex((value) => value === "revisión")
  if (courseIndex < 0) return

  Array.from(tbody.querySelectorAll(`tr[${HEADER_ATTR}]`)).forEach((row) => row.remove())
  const rows = Array.from(tbody.querySelectorAll("tr")) as HTMLTableRowElement[]
  const realRows = rows.filter((row) => row.cells.length > 1 && !row.querySelector("td[colspan]"))
  if (realRows.length === 0) return

  const signature = buildSignature(realRows, courseIndex)
  const currentSignature = tbody.getAttribute(PATCHED_ATTR)

  const groups: Record<string, HTMLTableRowElement[]> = {}
  realRows.forEach((row) => {
    const course = text(row.cells[courseIndex]) || "Sin curso"
    if (!groups[course]) groups[course] = []
    groups[course].push(row)
  })

  if (currentSignature === signature && tbody.querySelector(`tr[${HEADER_ATTR}]`)) {
    applyVisibility(tbody, groups)
    return
  }

  tbody.setAttribute(PATCHED_ATTR, signature)
  const fragment = document.createDocumentFragment()
  const colSpan = headers.length || 9

  Object.entries(groups).forEach(([course, courseRows]) => {
    const avgGrade = courseRows.reduce((acc, row) => acc + parseNumber(text(row.cells[gradeIndex])), 0) / Math.max(1, courseRows.length)
    const avgScore = courseRows.reduce((acc, row) => acc + parseNumber(text(row.cells[scoreIndex])), 0) / Math.max(1, courseRows.length)
    const reviewed = courseRows.filter((row) => text(row.cells[reviewIndex]).toLowerCase().includes("revisado")).length
    const pending = Math.max(0, courseRows.length - reviewed)

    fragment.appendChild(makeGroupHeader(course, courseRows, colSpan, { avgGrade, avgScore, reviewed, pending }))
    courseRows.forEach((row) => {
      row.setAttribute(GROUP_ATTR, course)
      fragment.appendChild(row)
    })
  })

  tbody.appendChild(fragment)
  applyVisibility(tbody, groups)
}

export default function ResultCourseGroups() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    const schedule = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(applyCourseGroups, 120)
    }

    schedule()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })
    const interval = window.setInterval(applyCourseGroups, 2000)

    return () => {
      if (timer) clearTimeout(timer)
      observer.disconnect()
      window.clearInterval(interval)
    }
  }, [])

  return null
}
