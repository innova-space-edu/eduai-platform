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

function findHeader(tbody: HTMLTableSectionElement, course: string) {
  return (Array.from(tbody.querySelectorAll(`tr[${HEADER_ATTR}]`)) as HTMLTableRowElement[]).find(
    (row) => row.getAttribute(HEADER_ATTR) === course,
  ) || null
}

function findGroupedRows(course: string) {
  return (Array.from(document.querySelectorAll(`tr[${GROUP_ATTR}]`)) as HTMLTableRowElement[]).filter(
    (row) => row.getAttribute(GROUP_ATTR) === course,
  )
}

function applyVisibility(tbody: HTMLTableSectionElement, groups: Record<string, HTMLTableRowElement[]>) {
  const openState = getOpenState()

  Object.entries(groups).forEach(([course, rows]) => {
    const open = openState[course] === true
    rows.forEach((row) => {
      row.hidden = !open
      row.setAttribute(GROUP_ATTR, course)
    })

    const header = findHeader(tbody, course)
    const button = header?.querySelector("button[data-eduai-course-toggle]") as HTMLButtonElement | null
    const icon = header?.querySelector("[data-eduai-course-icon]") as HTMLElement | null
    const label = header?.querySelector("[data-eduai-course-label]") as HTMLElement | null
    if (button) button.setAttribute("aria-expanded", String(open))
    if (icon) icon.textContent = open ? "▼" : "▶"
    if (label) label.textContent = open ? "Cerrar resultados" : "Abrir resultados"
  })
}

function makePill(label: string, value: string) {
  const pill = document.createElement("span")
  pill.className = "rounded-xl bg-white px-3 py-2 font-bold text-slate-700 shadow-sm"
  pill.textContent = `${label}: `

  const strong = document.createElement("b")
  strong.className = "text-slate-950"
  strong.textContent = value
  pill.appendChild(strong)
  return pill
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
  const small = document.createElement("p")
  small.className = "text-[11px] font-black uppercase tracking-[0.22em] text-emerald-600"
  small.textContent = "Curso"
  const titleRow = document.createElement("div")
  titleRow.className = "mt-1 flex flex-wrap items-center gap-2"
  const title = document.createElement("span")
  title.className = "text-lg font-black text-slate-900"
  title.textContent = course
  const count = document.createElement("span")
  count.className = "rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-black text-emerald-700"
  count.textContent = `${rows.length} estudiante${rows.length === 1 ? "" : "s"}`
  titleRow.append(title, count)
  left.append(small, titleRow)

  const metrics = document.createElement("div")
  metrics.className = "grid grid-cols-2 gap-2 text-xs sm:flex sm:items-center"
  metrics.append(
    makePill("Prom. nota", stats.avgGrade.toFixed(1)),
    makePill("Prom. logro", `${Math.round(stats.avgScore)}%`),
    makePill("Revisados", String(stats.reviewed)),
    makePill("Pendientes", String(stats.pending)),
  )

  const button = document.createElement("button")
  button.type = "button"
  button.setAttribute("data-eduai-course-toggle", "true")
  button.setAttribute("aria-expanded", String(open))
  button.className = "flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700"

  const icon = document.createElement("span")
  icon.setAttribute("data-eduai-course-icon", "true")
  icon.textContent = open ? "▼" : "▶"
  const label = document.createElement("span")
  label.setAttribute("data-eduai-course-label", "true")
  label.textContent = open ? "Cerrar resultados" : "Abrir resultados"
  button.append(icon, label)

  button.addEventListener("click", () => {
    const next = getOpenState()[course] !== true
    setCourseOpen(course, next)
    findGroupedRows(course).forEach((row) => (row.hidden = !next))
    button.setAttribute("aria-expanded", String(next))
    icon.textContent = next ? "▼" : "▶"
    label.textContent = next ? "Cerrar resultados" : "Abrir resultados"
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

  const rows = Array.from(tbody.querySelectorAll("tr")) as HTMLTableRowElement[]
  const realRows = rows.filter(
    (row) => !row.hasAttribute(HEADER_ATTR) && row.cells.length > 1 && !row.querySelector("td[colspan]"),
  )
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

  Array.from(tbody.querySelectorAll(`tr[${HEADER_ATTR}]`)).forEach((row) => row.remove())
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
