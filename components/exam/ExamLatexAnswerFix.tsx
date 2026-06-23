"use client"

import { useEffect } from "react"
import { buildReadableDevelopmentAnswer, normalizeLatexSource, normalizeMathTextForDisplay } from "@/lib/exam/latex-response"

const PATCH_KEY = "__eduaiExamLatexAnswerFix"
const CACHE_TTL_MS = 6000
const LATEST_ARTIFACTS_KEY = "__eduaiLatestDevelopmentArtifacts"

function isExamPage() {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/examen/p/")
}

function parseJsonSafe(value: string | null) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function getArtifactFromStorage(examId: string, attemptId: string, index: number) {
  if (typeof window === "undefined") return null
  const exactKey = `eduai-exam-notebook:${examId}:${attemptId}:${index}`
  const exact = parseJsonSafe(window.localStorage.getItem(exactKey))
  if (exact) return exact

  const suffix = `:${index}`
  const candidates: any[] = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i) || ""
    if (!key.startsWith("eduai-exam-notebook:") || !key.endsWith(suffix)) continue
    const parsed = parseJsonSafe(window.localStorage.getItem(key))
    if (parsed) candidates.push(parsed)
  }

  candidates.sort((a, b) => Date.parse(String(b?.updatedAt || 0)) - Date.parse(String(a?.updatedAt || 0)))
  return candidates[0] || null
}

function getArtifactsForSubmit(body: any) {
  const examId = String(body?.examId || "")
  const attemptId = String(body?.clientAttemptId || "")
  const answers = Array.isArray(body?.answers) ? body.answers : []
  return answers.map((_answer: any, index: number) => getArtifactFromStorage(examId, attemptId, index))
}

function normalizeAnswer(answer: any, artifact?: any) {
  if (!answer || typeof answer !== "object") return answer
  if (!("developmentLatex" in answer) && !("devText" in answer) && !artifact) return answer

  const artifactLatex = String(artifact?.latex || "")
  const latex = normalizeLatexSource(answer.developmentLatex || artifactLatex || "")
  const displayLatex = normalizeMathTextForDisplay(latex)
  const readable = buildReadableDevelopmentAnswer({ ...answer, developmentLatex: latex })
  const pages = Array.isArray(artifact?.pages) ? artifact.pages : []
  const previewPngDataUrl = typeof artifact?.previewPngDataUrl === "string" ? artifact.previewPngDataUrl : ""

  if (!latex && !readable && !pages.length && !previewPngDataUrl) return answer

  return {
    ...answer,
    // Para la evaluación automática se envía una lectura humana.
    // El LaTeX original queda guardado como fuente, pero no se usa como texto principal.
    devText: readable || answer.devText || displayLatex,
    developmentLatex: "",
    developmentLatexSource: latex,
    developmentRenderedText: displayLatex,
    developmentPreviewPngDataUrl: previewPngDataUrl,
    developmentPages: pages,
  }
}

function attachEvidenceToSubmission(data: any, artifacts: any[]) {
  if (!data?.submission || !Array.isArray(data.submission.answers)) return data
  const nextAnswers = data.submission.answers.map((answer: any, index: number) => {
    const artifact = artifacts[index]
    if (!artifact) return answer
    return {
      ...answer,
      developmentPreviewPngDataUrl: artifact.previewPngDataUrl || answer?.developmentPreviewPngDataUrl || "",
      developmentPages: Array.isArray(artifact.pages) ? artifact.pages : answer?.developmentPages,
      developmentLatexSource: artifact.latex || answer?.developmentLatexSource || answer?.developmentLatex || "",
    }
  })
  return { ...data, submission: { ...data.submission, answers: nextAnswers } }
}

async function tryRescoreSubmission(originalFetch: typeof fetch, data: any) {
  const submissionId = data?.submission?.id
  if (!submissionId) return data

  try {
    const res = await originalFetch("/api/agents/exam-math-rescore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId }),
    })
    const rescored = await res.json().catch(() => ({}))
    if (res.ok && rescored?.success && rescored?.submission) {
      return { ...data, submission: rescored.submission }
    }
  } catch {
    // Si el recalculo no está disponible, se usa la entrega original.
  }

  return data
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function svgDataUrlFromArtifact(artifact: any) {
  const pages = Array.isArray(artifact?.pages) ? artifact.pages : []
  const page = pages[0]
  if (!page || !Array.isArray(page.strokes)) return ""

  const width = 900
  const height = Math.min(Math.max(Number(page.canvasHeight) || 520, 360), 900)
  const polylines = page.strokes
    .map((stroke: any) => {
      const points = Array.isArray(stroke?.points)
        ? stroke.points
            .map((point: any) => `${Math.round(Number(point?.x) || 0)},${Math.round(Number(point?.y) || 0)}`)
            .join(" ")
        : ""
      if (!points) return ""
      return `<polyline points="${escapeHtml(points)}" fill="none" stroke="#0f172a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`
    })
    .join("")

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" fill="none" stroke="#e2e8f0" stroke-width="0.7"/></pattern></defs><rect width="100%" height="100%" fill="#ffffff"/><rect width="100%" height="100%" fill="url(#grid)"/>${polylines}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function getLatestArtifactsFromWindow(): any[] {
  if (typeof window === "undefined") return []
  const win = window as typeof window & Record<string, any>
  return Array.isArray(win[LATEST_ARTIFACTS_KEY]) ? win[LATEST_ARTIFACTS_KEY] : []
}

function findArtifactForQuestion(index: number) {
  const latest = getLatestArtifactsFromWindow()
  if (latest[index]) return latest[index]

  if (typeof window === "undefined") return null
  const candidates: any[] = []
  const suffix = `:${index}`
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i) || ""
    if (!key.startsWith("eduai-exam-notebook:") || !key.endsWith(suffix)) continue
    const parsed = parseJsonSafe(window.localStorage.getItem(key))
    if (parsed) candidates.push(parsed)
  }
  candidates.sort((a, b) => Date.parse(String(b?.updatedAt || 0)) - Date.parse(String(a?.updatedAt || 0)))
  return candidates[0] || null
}

function findSmallestQuestionCard(questionNumber: number) {
  const matches = Array.from(document.querySelectorAll("div")) as HTMLDivElement[]
  return matches
    .filter((el) => {
      const text = el.textContent || ""
      return text.includes(`Pregunta ${questionNumber} ·`) && text.includes("Tu respuesta")
    })
    .sort((a, b) => (a.textContent || "").length - (b.textContent || "").length)[0]
}

function injectDevelopmentEvidence() {
  if (typeof document === "undefined" || !isExamPage()) return
  const title = Array.from(document.querySelectorAll("h3, p, div")).some((el) =>
    (el.textContent || "").toLowerCase().includes("retroalimentación por pregunta"),
  )
  if (!title) return

  for (let index = 0; index < 40; index++) {
    const artifact = findArtifactForQuestion(index)
    if (!artifact) continue
    const imageSrc = artifact.previewPngDataUrl || svgDataUrlFromArtifact(artifact)
    if (!imageSrc) continue

    const card = findSmallestQuestionCard(index + 1)
    if (!card || card.querySelector(`[data-eduai-dev-evidence="${index}"]`)) continue

    const latex = normalizeMathTextForDisplay(artifact.latex || "")
    const evidence = document.createElement("div")
    evidence.setAttribute("data-eduai-dev-evidence", String(index))
    evidence.style.cssText = "margin-top:12px;border:1px solid #bfdbfe;background:#fff;border-radius:16px;padding:12px;"
    evidence.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
        <div>
          <p style="font-size:12px;font-weight:800;color:#1d4ed8;margin:0;">✍️ Lienzo del desarrollo</p>
          <p style="font-size:11px;color:#64748b;margin:2px 0 0;">Imagen del procedimiento escrito por el estudiante.</p>
        </div>
      </div>
      <div style="overflow:hidden;border:1px solid #e2e8f0;border-radius:14px;background:#fff;">
        <img src="${imageSrc}" alt="Lienzo del desarrollo" style="display:block;width:100%;max-height:360px;object-fit:contain;background:#fff;" />
      </div>
      ${latex ? `<p style="font-size:11px;color:#334155;margin:8px 0 0;"><strong>LaTeX reconocido:</strong> ${escapeHtml(latex.replace(/\$+/g, ""))}</p>` : ""}
    `

    const feedbackBox = Array.from(card.children).find((child) =>
      (child.textContent || "").toLowerCase().includes("retroalimentación basada"),
    )
    if (feedbackBox) card.insertBefore(evidence, feedbackBox)
    else card.appendChild(evidence)
  }
}

export default function ExamLatexAnswerFix() {
  useEffect(() => {
    if (typeof window === "undefined") return
    const win = window as typeof window & Record<string, any>
    if (win[PATCH_KEY]) return

    const originalFetch = window.fetch.bind(window)
    let lastRecognitionKey = ""
    let lastRecognitionAt = 0
    let lastRecognitionPayload: any = null
    win[PATCH_KEY] = true

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
        const method = String(init?.method || "GET").toUpperCase()

        if (isExamPage() && method === "POST" && url.includes("/api/whiteboard/recognize") && typeof init?.body === "string") {
          const key = init.body
          const now = Date.now()
          if (key === lastRecognitionKey && lastRecognitionPayload && now - lastRecognitionAt < CACHE_TTL_MS) {
            return new Response(JSON.stringify(lastRecognitionPayload), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          }

          // No pasamos signal para evitar que el estudiante vea errores de "reconocimiento abortado".
          // Si llega una respuesta antigua, el cuaderno la ignora por versión interna.
          const { signal: _signal, ...safeInit } = init as RequestInit & { signal?: AbortSignal }
          const response = await originalFetch(input, safeInit)
          const clone = response.clone()
          clone.json().then((payload) => {
            if (response.ok) {
              lastRecognitionKey = key
              lastRecognitionAt = Date.now()
              lastRecognitionPayload = payload
            }
          }).catch(() => {})
          return response
        }

        if (isExamPage() && method === "POST" && url.includes("/api/agents/examen-docente") && typeof init?.body === "string") {
          const body = JSON.parse(init.body)
          if (body?.action === "submit" && Array.isArray(body.answers)) {
            const artifacts = getArtifactsForSubmit(body)
            win[LATEST_ARTIFACTS_KEY] = artifacts
            const nextBody = { ...body, answers: body.answers.map((answer: any, index: number) => normalizeAnswer(answer, artifacts[index])) }
            const response = await originalFetch(input, { ...init, body: JSON.stringify(nextBody) })
            const data = await response.clone().json().catch(() => null)
            if (!response.ok || !data?.success) return response
            const rescoredData = await tryRescoreSubmission(originalFetch, data)
            const finalData = attachEvidenceToSubmission(rescoredData, artifacts)
            setTimeout(injectDevelopmentEvidence, 300)
            setTimeout(injectDevelopmentEvidence, 1200)
            return new Response(JSON.stringify(finalData), {
              status: response.status,
              statusText: response.statusText,
              headers: { "Content-Type": "application/json" },
            })
          }
        }
      } catch {
        // Se deja pasar la petición original si no corresponde a entrega/OCR de examen.
      }

      return originalFetch(input, init)
    }

    const observer = new MutationObserver(() => injectDevelopmentEvidence())
    observer.observe(document.body, { childList: true, subtree: true })
    injectDevelopmentEvidence()
    return () => observer.disconnect()
  }, [])

  return null
}
