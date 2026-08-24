import fs from "node:fs"
import path from "node:path"

const filePath = path.join(process.cwd(), "components/work/WorkChat.tsx")
let source = fs.readFileSync(filePath, "utf8")
let changed = false

function replaceOnce(from, to, label) {
  if (source.includes(to)) return
  if (!source.includes(from)) throw new Error(`[deep-research-work-ui] marker not found: ${label}`)
  source = source.replace(from, to)
  changed = true
}

replaceOnce(
  `function messageId() {\n  return typeof crypto !== "undefined" && "randomUUID" in crypto\n    ? crypto.randomUUID()\n    : \`\${Date.now()}-\${Math.random().toString(36).slice(2)}\`\n}\n`,
  `function messageId() {\n  return typeof crypto !== "undefined" && "randomUUID" in crypto\n    ? crypto.randomUUID()\n    : \`\${Date.now()}-\${Math.random().toString(36).slice(2)}\`\n}\n\nfunction waitForResearchPoll(ms: number, signal: AbortSignal) {\n  return new Promise<void>((resolve, reject) => {\n    if (signal.aborted) {\n      reject(new DOMException("Aborted", "AbortError"))\n      return\n    }\n    const onAbort = () => {\n      clearTimeout(timer)\n      reject(new DOMException("Aborted", "AbortError"))\n    }\n    const timer = setTimeout(() => {\n      signal.removeEventListener("abort", onAbort)\n      resolve()\n    }, ms)\n    signal.addEventListener("abort", onAbort, { once: true })\n  })\n}\n`,
  "abortable Deep Research polling helper",
)

replaceOnce(
  `  const [scope, setScope] = useState<ResearchScope>("sources_web")\n  const [copiedId, setCopiedId] = useState<string | null>(null)`,
  `  const [scope, setScope] = useState<ResearchScope>("sources_web")\n  const [deepResearchMode, setDeepResearchMode] = useState(false)\n  const [copiedId, setCopiedId] = useState<string | null>(null)`,
  "Deep Research mode state",
)

const fastResearchBlock = `      if (mode === "research") {\n        const response = await fetch("/api/work/research", {\n          method: "POST",\n          headers: { "Content-Type": "application/json" },\n          signal: abortRef.current.signal,\n          body: JSON.stringify({ message: content, history, notebookId, scope }),\n        })\n        const data = await response.json().catch(() => ({}))\n        if (!response.ok) throw new Error(data?.error || "No fue posible completar la investigación")\n        const citations = Array.isArray(data?.citations) ? data.citations : []\n        onCitationsChange(citations)\n        setMessages((current) => current.map((message) => message.id === pendingId ? {\n          id: pendingId,\n          role: "assistant",\n          content: data.text,\n          provider: data.provider,\n          model: data.model,\n          citations,\n        } : message))\n        return\n      }`

const dualResearchBlock = `      if (mode === "research") {\n        if (deepResearchMode) {\n          const signal = abortRef.current.signal\n          const response = await fetch("/api/work/deep-research", {\n            method: "POST",\n            headers: { "Content-Type": "application/json" },\n            signal,\n            body: JSON.stringify({ message: content, notebookId, scope }),\n          })\n          let data = await response.json().catch(() => ({}))\n          if (!response.ok) throw new Error(data?.error || "No fue posible iniciar la investigación profunda")\n\n          const jobId = typeof data?.jobId === "string" ? data.jobId : null\n          while (jobId && !["completed", "failed", "cancelled"].includes(String(data?.status || "running"))) {\n            await waitForResearchPoll(5_000, signal)\n            const poll = await fetch(\`/api/work/deep-research?id=\${encodeURIComponent(jobId)}\`, {\n              method: "GET",\n              signal,\n              cache: "no-store",\n            })\n            data = await poll.json().catch(() => ({}))\n            if (!poll.ok && data?.status !== "failed") {\n              throw new Error(data?.error || "No fue posible consultar la investigación profunda")\n            }\n          }\n\n          if (data?.status !== "completed" || typeof data?.text !== "string") {\n            throw new Error(data?.error || "La investigación profunda no pudo completarse")\n          }\n\n          const citations = Array.isArray(data?.citations) ? data.citations : []\n          onCitationsChange(citations)\n          setMessages((current) => current.map((message) => message.id === pendingId ? {\n            id: pendingId,\n            role: "assistant",\n            content: data.text,\n            provider: "Google Deep Research",\n            model: data.agent,\n            toolUsed: data.reused ? "deep research reutilizado" : "deep research",\n            citations,\n          } : message))\n          if (data?.assetId || jobId) {\n            onResultCreated({\n              id: data?.assetId || \`deep-research-\${jobId}\`,\n              title: content.slice(0, 120) || "Investigación profunda",\n              type: data.reused ? "Investigación reutilizada" : "Investigación profunda",\n            })\n          }\n          return\n        }\n\n        const response = await fetch("/api/work/research", {\n          method: "POST",\n          headers: { "Content-Type": "application/json" },\n          signal: abortRef.current.signal,\n          body: JSON.stringify({ message: content, history, notebookId, scope }),\n        })\n        const data = await response.json().catch(() => ({}))\n        if (!response.ok) throw new Error(data?.error || "No fue posible completar la investigación")\n        const citations = Array.isArray(data?.citations) ? data.citations : []\n        onCitationsChange(citations)\n        setMessages((current) => current.map((message) => message.id === pendingId ? {\n          id: pendingId,\n          role: "assistant",\n          content: data.text,\n          provider: data.provider,\n          model: data.model,\n          citations,\n        } : message))\n        return\n      }`

replaceOnce(fastResearchBlock, dualResearchBlock, "dual fast/deep research execution")

replaceOnce(
  `  }, [input, loading, messages, mode, notebookId, notebookTitle, onCitationsChange, onResultCreated, readySourceCount, scope])`,
  `  }, [deepResearchMode, input, loading, messages, mode, notebookId, notebookTitle, onCitationsChange, onResultCreated, readySourceCount, scope])`,
  "sendMessage dependency",
)

const scopeControl = `        {mode === "research" && (\n          <label className="flex shrink-0 items-center gap-1.5 rounded-xl border border-soft bg-card-soft-theme px-2 py-1.5 text-[10px] text-sub">\n            <Globe2 size={12} />\n            <span className="sr-only">Alcance de investigación</span>\n            <select\n              value={scope}\n              onChange={(event) => setScope(event.target.value as ResearchScope)}\n              className="max-w-32 bg-transparent font-semibold outline-none"\n            >\n              <option value="sources_web">Fuentes + web</option>\n              <option value="sources" disabled={!notebookId || readySourceCount === 0}>Solo fuentes</option>\n              <option value="web">Solo web</option>\n            </select>\n          </label>\n        )}`

const researchControls = `        {mode === "research" && (\n          <div className="flex shrink-0 items-center gap-2">\n            <label className="flex items-center gap-1.5 rounded-xl border border-soft bg-card-soft-theme px-2 py-1.5 text-[10px] text-sub">\n              <Globe2 size={12} />\n              <span className="sr-only">Alcance de investigación</span>\n              <select\n                value={scope}\n                onChange={(event) => setScope(event.target.value as ResearchScope)}\n                disabled={loading}\n                className="max-w-32 bg-transparent font-semibold outline-none disabled:opacity-50"\n              >\n                <option value="sources_web">Fuentes + web</option>\n                <option value="sources" disabled={!notebookId || readySourceCount === 0}>Solo fuentes</option>\n                <option value="web">Solo web</option>\n              </select>\n            </label>\n            <button\n              type="button"\n              onClick={() => setDeepResearchMode((current) => !current)}\n              disabled={loading}\n              title="Rápida usa grounding actual. Profunda crea un job recuperable de Google Deep Research."\n              className={\`rounded-xl border px-2.5 py-1.5 text-[10px] font-semibold transition disabled:opacity-50 \${deepResearchMode ? "border-violet-400/40 bg-violet-500/10 text-violet-500" : "border-soft bg-card-soft-theme text-sub hover:text-main"}\`}\n            >\n              {deepResearchMode ? "Profunda" : "Rápida"}\n            </button>\n          </div>\n        )}`

replaceOnce(scopeControl, researchControls, "research fast/deep selector")

replaceOnce(
  `                    <span>Analizando y coordinando herramientas…</span>`,
  `                    <span>{mode === "research" && deepResearchMode ? "Investigación profunda en curso…" : "Analizando y coordinando herramientas…"}</span>`,
  "Deep Research loading label",
)

if (changed) {
  fs.writeFileSync(filePath, source)
  console.log("[deep-research-work-ui] Open EDUAI Work conserva investigación rápida y añade modo Profunda con polling")
} else {
  console.log("[deep-research-work-ui] already applied")
}
