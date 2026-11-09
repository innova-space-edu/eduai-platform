"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Python runs only after an explicit click, inside a sandboxed opaque-origin
 * iframe that creates a dedicated worker. No Python is executed on the server.
 */
const WORKER_SOURCE = [
  "self.onmessage = async (event) => {",
  "  const { runId, code } = event.data;",
  "  const lines = [];",
  "  try {",
  "    const base = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/';",
  "    importScripts(base + 'pyodide.js');",
  "    const py = await loadPyodide({ indexURL: base });",
  "    py.setStdout({ batched: text => lines.push(text) });",
  "    py.setStderr({ batched: text => lines.push(text) });",
  "    await py.loadPackagesFromImports(code);",
  "    const value = await py.runPythonAsync(code);",
  "    if (value !== undefined && value !== null) lines.push(String(value));",
  "    self.postMessage({ kind: 'DONE', runId, output: lines.join('\\n').slice(0, 12000) || 'Ejecutado sin salida.', ok: true });",
  "  } catch (error) {",
  "    self.postMessage({ kind: 'DONE', runId, output: (lines.join('\\n') + '\\n' + String(error)).slice(0, 12000), ok: false });",
  "  }",
  "};",
].join("\n")

const FRAME_SOURCE = [
  "<!doctype html><html><head><meta charset='utf-8'></head><body><script>",
  "const worker = new Worker(URL.createObjectURL(new Blob([",
  JSON.stringify(WORKER_SOURCE),
  "], { type: 'text/javascript' })));",
  "worker.onmessage = event => window.parent.postMessage(event.data, '*');",
  "worker.onerror = event => window.parent.postMessage({ kind: 'DONE', runId: window.runId, output: String(event.message || 'Error de Python'), ok: false }, '*');",
  "window.addEventListener('message', event => {",
  "  if (event.data && event.data.kind === 'RUN' && typeof event.data.code === 'string') {",
  "    window.runId = event.data.runId;",
  "    worker.postMessage(event.data);",
  "  }",
  "});",
  "</script></body></html>",
].join("")

export default function PythonSandbox({ code }: { code: string }) {
  const [runId, setRunId] = useState<string | null>(null)
  const [output, setOutput] = useState("")
  const [state, setState] = useState<"idle" | "done" | "error" | "cancelled">("idle")
  const frameRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (!runId) return
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return
      const payload = event.data
      if (payload?.kind !== "DONE" || payload.runId !== runId) return
      setOutput(String(payload.output || "").slice(0, 12000))
      setState(payload.ok ? "done" : "error")
      setRunId(null)
    }
    window.addEventListener("message", onMessage)
    const timer = window.setTimeout(() => {
      setOutput("La ejecución excedió 45 segundos y se detuvo.")
      setState("error")
      setRunId(null)
    }, 45_000)
    return () => {
      window.removeEventListener("message", onMessage)
      window.clearTimeout(timer)
    }
  }, [runId])

  const execute = () => {
    if (code.length > 12_000) {
      setState("error")
      setOutput("Código demasiado largo para ejecutarlo en el navegador.")
      return
    }
    setOutput("")
    setState("idle")
    setRunId(crypto.randomUUID())
  }

  return (
    <div className="border-t border-slate-700 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={execute} disabled={Boolean(runId)} className="rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
          {runId ? "Ejecutando…" : "Ejecutar Python"}
        </button>
        {runId && <button type="button" onClick={() => { setRunId(null); setState("cancelled"); setOutput("Ejecución cancelada.") }} className="text-[11px] text-slate-300 underline">Detener</button>}
        <span className="text-[10px] text-slate-400">Pyodide · navegador aislado · requiere Internet</span>
      </div>
      {runId && (
        <iframe
          key={runId}
          ref={frameRef}
          title="Ejecución aislada de Python"
          sandbox="allow-scripts"
          srcDoc={FRAME_SOURCE}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          onLoad={() => frameRef.current?.contentWindow?.postMessage({ kind: "RUN", runId, code }, "*")}
        />
      )}
      {(output || state === "done") && <pre aria-live="polite" className={"mt-2 max-h-52 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-2 text-xs " + (state === "error" ? "text-rose-300" : "text-green-200")}>{output}</pre>}
    </div>
  )
}
