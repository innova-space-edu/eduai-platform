"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
import katex from "katex"
import "katex/dist/katex.min.css"

type RubricItem = { criteria?: string; points?: number }

type PdfQuestion = {
  type?: "multiple_choice" | "true_false" | "development" | "mixed_choice_development" | string
  question?: string
  statement?: string
  options?: string[]
  correctAnswer?: number
  answerText?: string
  explanation?: string
  solutionSteps?: string[]
  distractorRationales?: string[]
  selectionPoints?: number
  justificationMaxPoints?: number
  developmentMaxPoints?: number
  modelAnswer?: string
  expectedLatex?: string
  rubric?: RubricItem[]
  maxPoints?: number
  imageUrl?: string
}

type Props = {
  title: string
  topic?: string
  instructions?: string
  questions: PdfQuestion[]
  settings?: any
  totalPoints?: number
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function sanitizeFilename(value: string) {
  return String(value || "evaluacion")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "evaluacion"
}

function normalizeLatexSource(value: string) {
  return String(value || "")
    .replace(/\\\(/g, "$`) // temporary marker to avoid replacing inner parens
    .replace(/\\\)/g, "`$")
    .replace(/\\\[/g, "$$")
    .replace(/\\\]/g, "$$")
    .replace(/\$`/g, "$")
    .replace(/`\$/g, "$")
}

function renderLatex(latex: string, displayMode: boolean) {
  try {
    return katex.renderToString(latex.trim(), {
      throwOnError: false,
      displayMode,
      strict: false,
      trust: false,
    })
  } catch {
    return escapeHtml(latex)
  }
}

function renderRichText(value: unknown) {
  const text = normalizeLatexSource(String(value ?? ""))
  const parts: string[] = []
  const re = /(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(escapeHtml(text.slice(last, match.index)))
    const raw = match[0]
    if (raw.startsWith("$$")) parts.push(renderLatex(raw.slice(2, -2), true))
    else parts.push(renderLatex(raw.slice(1, -1), false))
    last = match.index + raw.length
  }

  if (last < text.length) parts.push(escapeHtml(text.slice(last)))
  return parts.join("").replace(/\n/g, "<br />")
}

function questionTypeLabel(type?: string) {
  if (type === "multiple_choice") return "Alternativas"
  if (type === "true_false") return "Verdadero / Falso"
  if (type === "mixed_choice_development") return "Alternativa + desarrollo"
  return "Desarrollo"
}

function getQuestionPoints(q: PdfQuestion) {
  if (q.type === "true_false") {
    return Math.max(0, Number(q.selectionPoints ?? 1)) + Math.max(0, Number(q.justificationMaxPoints ?? 0))
  }
  if (q.type === "mixed_choice_development") {
    return Math.max(0, Number(q.selectionPoints ?? 0)) + Math.max(0, Number(q.developmentMaxPoints ?? 0))
  }
  if (Array.isArray(q.rubric) && q.rubric.length > 0) {
    const total = q.rubric.reduce((sum, item) => sum + Math.max(0, Number(item.points || 0)), 0)
    if (total > 0) return total
  }
  return Math.max(0, Number(q.maxPoints || 0))
}

function buildQuestionHtml(q: PdfQuestion, index: number) {
  const points = getQuestionPoints(q)
  const options = Array.isArray(q.options) ? q.options : []
  const correctIndex = Number.isInteger(Number(q.correctAnswer)) ? Number(q.correctAnswer) : -1
  const isChoice = q.type === "multiple_choice" || q.type === "mixed_choice_development"
  const isTrueFalse = q.type === "true_false"
  const isDevelopment = q.type === "development" || q.type === "mixed_choice_development"

  const optionsHtml = (isChoice || isTrueFalse) && options.length > 0
    ? `<div class="options">
        ${options.map((option, optionIndex) => {
          const selected = optionIndex === correctIndex
          const letter = isTrueFalse ? (optionIndex === 0 ? "V" : "F") : String.fromCharCode(65 + optionIndex)
          return `<div class="option ${selected ? "correct" : ""}">
            <span class="option-letter">${selected ? "✓" : letter}</span>
            <div class="option-text">${renderRichText(option)}</div>
            ${selected ? `<span class="correct-chip">Correcta</span>` : ""}
          </div>`
        }).join("")}
      </div>`
    : ""

  const distractorsHtml = Array.isArray(q.distractorRationales) && q.distractorRationales.some(Boolean)
    ? `<div class="mini-block"><h4>Retroalimentación por alternativa</h4><ul>${q.distractorRationales
        .map((item, i) => item ? `<li><strong>${String.fromCharCode(65 + i)}.</strong> ${renderRichText(item)}</li>` : "")
        .join("")}</ul></div>`
    : ""

  const stepsHtml = Array.isArray(q.solutionSteps) && q.solutionSteps.some(Boolean)
    ? `<div class="mini-block"><h4>Pasos de solución</h4><ol>${q.solutionSteps
        .map((step) => step ? `<li>${renderRichText(step)}</li>` : "")
        .join("")}</ol></div>`
    : ""

  const rubricHtml = isDevelopment && Array.isArray(q.rubric) && q.rubric.length > 0
    ? `<div class="mini-block"><h4>Rúbrica de desarrollo</h4><div class="rubric">${q.rubric
        .map((item) => `<div class="rubric-row"><span>${renderRichText(item.criteria || "Criterio")}</span><strong>${Number(item.points || 0)} pts</strong></div>`)
        .join("")}</div></div>`
    : ""

  const modelHtml = isDevelopment && (q.modelAnswer || q.expectedLatex)
    ? `<div class="answer-box"><h4>Respuesta modelo / LaTeX esperado</h4>${q.modelAnswer ? `<p>${renderRichText(q.modelAnswer)}</p>` : ""}${q.expectedLatex ? `<p class="latex-line">${renderRichText(`$${q.expectedLatex}$`)}</p>` : ""}</div>`
    : ""

  return `<article class="question-card">
    <div class="question-head">
      <div class="badge">${index + 1}</div>
      <div class="question-meta">
        <p>Pregunta ${index + 1}</p>
        <h3>${questionTypeLabel(q.type)}</h3>
      </div>
      <div class="points">${points} pts</div>
    </div>

    ${q.imageUrl ? `<div class="image-note">Imagen asociada: ${escapeHtml(q.imageUrl)}</div>` : ""}

    <div class="question-text">${renderRichText(q.question || q.statement || "")}</div>

    ${optionsHtml}

    ${(isChoice || isTrueFalse) ? `<div class="answer-box"><h4>Respuesta correcta</h4><p>${correctIndex >= 0 ? renderRichText(options[correctIndex] || q.answerText || "") : renderRichText(q.answerText || "")}</p></div>` : ""}

    ${modelHtml}

    ${q.explanation ? `<div class="feedback"><h4>Explicación / retroalimentación</h4><p>${renderRichText(q.explanation)}</p></div>` : ""}

    ${stepsHtml}
    ${distractorsHtml}
    ${rubricHtml}
  </article>`
}

function buildPdfHtml({ title, topic, instructions, questions, totalPoints }: Props) {
  const date = new Date().toLocaleDateString("es-CL")
  const computedTotal = totalPoints ?? questions.reduce((sum, q) => sum + getQuestionPoints(q), 0)

  return `<div class="pdf-root">
    <style>
      .pdf-root {
        width: 794px;
        min-height: 1123px;
        background: #f8fafc;
        color: #102a2a;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        padding: 34px;
        box-sizing: border-box;
      }
      .cover {
        border-radius: 30px;
        padding: 28px;
        background: linear-gradient(135deg, #e0f2fe 0%, #ecfdf5 46%, #fff7ed 100%);
        border: 1px solid #bfdbfe;
        box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
        margin-bottom: 22px;
      }
      .eyebrow { color: #2563eb; font-size: 11px; font-weight: 900; letter-spacing: .18em; text-transform: uppercase; margin: 0 0 8px; }
      .cover h1 { margin: 0; font-size: 29px; line-height: 1.05; color: #0f172a; }
      .cover .topic { margin: 10px 0 0; color: #475569; font-size: 14px; line-height: 1.45; }
      .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 18px; }
      .stat { border-radius: 18px; background: rgba(255,255,255,.78); border: 1px solid rgba(255,255,255,.9); padding: 12px; }
      .stat span { display:block; color:#64748b; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.12em; }
      .stat strong { display:block; color:#0f172a; font-size:18px; margin-top:3px; }
      .instructions { border-radius: 22px; padding: 16px; background: #ffffff; border: 1px solid #dbeafe; margin-bottom: 18px; }
      .instructions h2, .mini-block h4, .feedback h4, .answer-box h4 { margin: 0 0 8px; color:#2563eb; font-size: 11px; text-transform: uppercase; letter-spacing: .14em; font-weight: 900; }
      .instructions p { margin:0; font-size:13px; color:#334155; line-height:1.55; }
      .question-card { page-break-inside: avoid; break-inside: avoid; border-radius: 28px; padding: 20px; background: #ffffff; border: 1px solid #dbeafe; margin: 0 0 18px; box-shadow: 0 12px 28px rgba(15,23,42,.06); }
      .question-head { display:flex; align-items:center; gap:12px; margin-bottom:14px; }
      .badge { width:42px; height:42px; border-radius:16px; background:linear-gradient(135deg,#2563eb,#2f7f7b); color:white; display:flex; align-items:center; justify-content:center; font-weight:900; }
      .question-meta { flex:1; }
      .question-meta p { margin:0; color:#64748b; font-size:10px; font-weight:900; letter-spacing:.14em; text-transform:uppercase; }
      .question-meta h3 { margin:2px 0 0; color:#0f172a; font-size:15px; }
      .points { border-radius:999px; background:#dcfce7; color:#166534; padding:7px 11px; font-size:12px; font-weight:900; }
      .question-text { border-radius:20px; background:#f8fafc; border:1px solid #e2e8f0; padding:14px; font-size:15px; font-weight:700; color:#0f172a; line-height:1.55; margin-bottom:14px; }
      .options { display:grid; gap:9px; margin-bottom:14px; }
      .option { display:flex; align-items:flex-start; gap:10px; border:1px solid #e2e8f0; background:#ffffff; border-radius:18px; padding:10px; }
      .option.correct { border-color:#86efac; background:#f0fdf4; }
      .option-letter { width:28px; height:28px; border-radius:999px; background:#e0f2fe; color:#2563eb; display:flex; align-items:center; justify-content:center; font-weight:900; flex-shrink:0; }
      .option.correct .option-letter { background:#22c55e; color:white; }
      .option-text { flex:1; font-size:13px; color:#1e293b; line-height:1.45; }
      .correct-chip { border-radius:999px; background:#dcfce7; color:#166534; padding:5px 8px; font-size:10px; font-weight:900; }
      .answer-box, .feedback, .mini-block { border-radius:20px; border:1px solid #dbeafe; background:#eff6ff; padding:13px; margin-top:10px; }
      .feedback { border-color:#fed7aa; background:#fff7ed; }
      .answer-box p, .feedback p { margin:0; color:#334155; font-size:12px; line-height:1.55; }
      .mini-block ul, .mini-block ol { margin:0; padding-left:18px; color:#334155; font-size:12px; line-height:1.55; }
      .rubric { display:grid; gap:7px; }
      .rubric-row { display:flex; justify-content:space-between; gap:12px; border-radius:14px; background:white; border:1px solid #dbeafe; padding:8px 10px; font-size:12px; color:#334155; }
      .rubric-row strong { color:#166534; white-space:nowrap; }
      .latex-line { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
      .image-note { border-radius:14px; background:#fefce8; border:1px solid #fde68a; color:#854d0e; padding:9px 10px; font-size:11px; margin-bottom:10px; }
      .katex { font-size: 1.04em; }
      .katex-display { margin: .45em 0; overflow: visible; }
    </style>

    <section class="cover">
      <p class="eyebrow">Evaluación docente · PDF de revisión</p>
      <h1>${renderRichText(title || "Evaluación")}</h1>
      ${topic ? `<p class="topic">${renderRichText(topic)}</p>` : ""}
      <div class="stats">
        <div class="stat"><span>Preguntas</span><strong>${questions.length}</strong></div>
        <div class="stat"><span>Puntaje</span><strong>${computedTotal}</strong></div>
        <div class="stat"><span>Fecha</span><strong>${date}</strong></div>
      </div>
    </section>

    ${instructions ? `<section class="instructions"><h2>Instrucciones</h2><p>${renderRichText(instructions)}</p></section>` : ""}

    ${questions.map((q, i) => buildQuestionHtml(q, i)).join("")}
  </div>`
}

export default function ExamPdfDownloadButton(props: Props) {
  const [loading, setLoading] = useState(false)

  async function downloadPdf() {
    if (loading) return
    setLoading(true)

    let container: HTMLDivElement | null = null

    try {
      const [{ toCanvas }, { jsPDF }] = await Promise.all([
        import("html-to-image"),
        import("jspdf"),
      ])

      container = document.createElement("div")
      container.style.position = "fixed"
      container.style.left = "-10000px"
      container.style.top = "0"
      container.style.background = "#f8fafc"
      container.innerHTML = buildPdfHtml(props)
      document.body.appendChild(container)

      const root = container.firstElementChild as HTMLElement | null
      if (!root) throw new Error("No fue posible preparar el PDF.")

      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

      const canvas = await toCanvas(root, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#f8fafc",
      })

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const pageWidth = 210
      const pageHeight = 297
      const sliceHeight = Math.floor(canvas.width * (pageHeight / pageWidth))
      let y = 0
      let page = 0

      while (y < canvas.height) {
        const currentSliceHeight = Math.min(sliceHeight, canvas.height - y)
        const pageCanvas = document.createElement("canvas")
        pageCanvas.width = canvas.width
        pageCanvas.height = currentSliceHeight
        const ctx = pageCanvas.getContext("2d")
        if (!ctx) throw new Error("No fue posible generar una página del PDF.")
        ctx.fillStyle = "#f8fafc"
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
        ctx.drawImage(canvas, 0, y, canvas.width, currentSliceHeight, 0, 0, canvas.width, currentSliceHeight)

        if (page > 0) pdf.addPage()
        const img = pageCanvas.toDataURL("image/png", 0.98)
        const imgHeightMm = (currentSliceHeight / canvas.width) * pageWidth
        pdf.addImage(img, "PNG", 0, 0, pageWidth, Math.min(pageHeight, imgHeightMm), undefined, "FAST")

        y += currentSliceHeight
        page += 1
      }

      pdf.save(`${sanitizeFilename(props.title)}.pdf`)
    } catch (error) {
      console.error("[ExamPdfDownloadButton]", error)
      alert(error instanceof Error ? error.message : "No fue posible descargar el PDF.")
    } finally {
      if (container?.parentNode) container.parentNode.removeChild(container)
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={downloadPdf}
      disabled={loading || !props.questions?.length}
      className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(59,130,246,0.10))",
        borderColor: "rgba(16,185,129,0.32)",
        color: "#047857",
      }}
      title="Descargar esta evaluación en PDF"
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
      {loading ? "Generando..." : "Descargar PDF"}
    </button>
  )
}
