"use client"

import "katex/dist/katex.min.css"
import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"

function normalizeMathDelimiters(text: string) {
  return String(text || "")
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, expr) => `$${expr}$`)
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, expr) => `$$${expr}$$`)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim()
}

export default function ExamMathText({
  text,
  className = "",
}: {
  text: string
  className?: string
}) {
  if (!text) return null

  const content = normalizeMathDelimiters(text)

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <span>{children}</span>,
          code: ({ children }) => <code>{children}</code>,
          pre: ({ children }) => <pre>{children}</pre>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
