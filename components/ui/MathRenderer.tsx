"use client"

import "katex/dist/katex.min.css"
import { InlineMath, BlockMath } from "react-katex"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"

interface Props {
  content: string
  className?: string
}

export default function MathRenderer({ content, className = "" }: Props) {
  return (
    <div className={`math-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Párrafos normales
          p: ({ children }) => (
            <p className="text-sub leading-relaxed mb-3">{children}</p>
          ),
          // Headings
          h1: ({ children }) => <h1 className="text-main text-xl font-bold mt-4 mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-main text-lg font-semibold mt-3 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-blue-700 text-base font-medium mt-2 mb-1">{children}</h3>,
          // Código inline (no math)
          code: ({ children, className }) => {
            const isMath = className?.includes("math")
            if (isMath) return <code className={className}>{children}</code>
            return (
              <code className="bg-card-soft-theme text-orange-700 px-1.5 py-0.5 rounded text-sm font-mono">
                {children}
              </code>
            )
          },
          // Bloques de código
          pre: ({ children }) => (
            <pre className="bg-card-soft-theme border border-soft rounded-xl p-4 overflow-x-auto text-sm font-mono text-sub my-3">
              {children}
            </pre>
          ),
          // Listas
          ul: ({ children }) => <ul className="list-disc list-inside text-sub space-y-1 mb-3 ml-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside text-sub space-y-1 mb-3 ml-2">{children}</ol>,
          li: ({ children }) => <li className="text-sub">{children}</li>,
          // Strong/em
          strong: ({ children }) => <strong className="text-main font-semibold">{children}</strong>,
          em: ({ children }) => <em className="text-blue-700 italic">{children}</em>,
          // Blockquote
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-blue-500 pl-4 text-sub italic my-3">
              {children}
            </blockquote>
          ),
          // Tablas
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="w-full border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="bg-card-soft-theme text-blue-700 font-semibold px-4 py-2 text-left text-sm border border-medium">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2 text-sub text-sm border border-soft">{children}</td>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-card-soft-theme transition-colors">{children}</tr>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
