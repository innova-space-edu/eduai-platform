import { readFileSync, writeFileSync } from "node:fs"

const filePath = "app/dashboard/page.tsx"
let source = readFileSync(filePath, "utf8")

if (!source.includes("NotebookPen,")) {
  source = source.replace("  Music2,\n", "  Music2,\n  NotebookPen,\n")
}

const notebookLink = '  { href: "/notebooks", icon: NotebookPen, label: "Cuaderno EduAI", color: "#4f46e5" },'
if (!source.includes('href: "/notebooks"')) {
  source = source.replace(
    '  { href: "/sessions", icon: BookOpen, label: "Sesiones", color: "#7c3aed" },',
    `  { href: "/sessions", icon: BookOpen, label: "Sesiones", color: "#7c3aed" },\n${notebookLink}`,
  )
}

writeFileSync(filePath, source)
