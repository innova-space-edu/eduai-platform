"use client"

import { Children, isValidElement, useState, type ReactNode } from "react"
import "katex/dist/katex.min.css"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import EduAIChart from "@/components/ui/EduAIChart"
import PythonSandbox from "@/components/ui/PythonSandbox"
import { prepareRichChatContent } from "@/lib/text/prepare-rich-chat-content"

interface Props {
  content: string
  className?: string
}

function CodePanel({ language, content }: { language: string; content: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }
  function downloadPython() {
    const url = URL.createObjectURL(new Blob([content], { type: "text/x-python;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = "eduai-codigo.py"
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }
  return (
    <div className="my-3 min-w-0 overflow-hidden rounded-xl border border-soft bg-slate-950">
      <div className="flex items-center justify-between gap-2 border-b border-slate-700 px-3 py-1.5 text-[11px] text-slate-200">
        <span className="font-semibold uppercase tracking-wide">{language || "código"}</span>
        <div className="flex gap-2">
          {language === "python" && <button type="button" onClick={downloadPython} className="hover:text-white">Descargar .py</button>}
          <button type="button" onClick={() => void copy()} className="hover:text-white">{copied ? "Copiado" : "Copiar"}</button>
        </div>
      </div>
      <pre className="max-w-full overflow-x-auto p-3 text-xs leading-relaxed text-slate-100"><code>{content}</code></pre>
      {language === "python" && <PythonSandbox code={content} />}
    </div>
  )
}

function RenderCode({ children }: { children?: ReactNode }) {
  const element = Children.toArray(children)[0]
  if (!isValidElement<{ className?: string; children?: ReactNode }>(element)) {
    return <pre className="overflow-auto rounded-lg bg-card-soft-theme p-3">{children}</pre>
  }
  const language = (element.props.className || "").match(/language-([\w-]+)/)?.[1]?.toLowerCase() || ""
  const content = String(element.props.children ?? "").replace(/\n$/, "")
  if (language === "eduai-chart" || language === "eduai-plot") return <EduAIChart raw={content} />
  return <CodePanel language={language} content={content} />
}

export default function MathRenderer({ content, className = "" }: Props) {
  return (
    <div className={"math-content min-w-0 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden " + className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore", trust: false }]]}
        components={{
          p: ({ children }) => <p className="mb-3 break-words leading-relaxed text-sub">{children}</p>,
          h1: ({ children }) => <h1 className="mb-2 mt-4 text-xl font-bold text-main">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-2 mt-4 border-b border-soft pb-1 text-lg font-bold text-main">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-1 mt-3 text-base font-semibold text-blue-700">{children}</h3>,
          pre: RenderCode,
          code: ({ children, className }) => <code className={className || "rounded bg-card-soft-theme px-1.5 py-0.5 font-mono text-[0.9em] text-blue-700"}>{children}</code>,
          ul: ({ children }) => <ul className="mb-3 ml-4 list-disc space-y-1 text-sub">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 ml-4 list-decimal space-y-1 text-sub">{children}</ol>,
          li: ({ children }) => <li className="pl-1">{children}</li>,
          strong: ({ children }) => <strong className="font-bold text-main">{children}</strong>,
          em: ({ children }) => <em className="italic text-sub">{children}</em>,
          blockquote: ({ children }) => <blockquote className="my-3 border-l-4 border-blue-400 bg-blue-500/5 py-2 pl-3 italic text-sub">{children}</blockquote>,
          table: ({ children }) => <div className="my-3 max-w-full overflow-x-auto rounded-lg border border-soft"><table className="w-full border-collapse text-sm">{children}</table></div>,
          th: ({ children }) => <th className="border-b border-soft bg-blue-500/10 px-3 py-2 text-left font-bold text-main">{children}</th>,
          td: ({ children }) => <td className="border-b border-soft px-3 py-2 text-sub">{children}</td>,
          a: ({ children, href }) => <a href={href} target={href?.startsWith("https://") ? "_blank" : undefined} rel={href?.startsWith("https://") ? "noopener noreferrer" : undefined} className="font-medium text-blue-700 underline underline-offset-2">{children}</a>,
        }}
      >
        {prepareRichChatContent(content)}
      </ReactMarkdown>
    </div>
  )
}
