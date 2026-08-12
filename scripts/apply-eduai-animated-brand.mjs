import { existsSync, readFileSync, writeFileSync } from "node:fs"

const MARKER = "EDUAI_ANIMATED_BRAND_V1"

function load(path) {
  if (!existsSync(path)) throw new Error(`[eduai-brand] No existe ${path}`)
  return readFileSync(path, "utf8")
}

function save(path, source) {
  writeFileSync(path, source)
}

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) {
    throw new Error(`[eduai-brand] No se encontró ${label}`)
  }
  return source.replace(from, to)
}

function replaceRegexRequired(source, pattern, replacement, label) {
  if (!pattern.test(source)) {
    throw new Error(`[eduai-brand] No se encontró ${label}`)
  }
  pattern.lastIndex = 0
  return source.replace(pattern, replacement)
}

function patchDashboard() {
  const path = "app/dashboard/page.tsx"
  let source = load(path)
  if (source.includes(MARKER)) return

  source = replaceRequired(
    source,
    'import ClawStudyConsole from "@/components/dashboard/ClawStudyConsole"',
    [
      'import ClawStudyConsole from "@/components/dashboard/ClawStudyConsole"',
      'import EduAIBrand from "@/components/branding/EduAIBrand"',
      `// ${MARKER}`,
    ].join("\n"),
    "import del dashboard",
  )

  source = replaceRegexRequired(
    source,
    /          <div className="flex h-12 flex-shrink-0 items-center gap-2 border-b px-2\.5 lg:h-14 lg:gap-3 lg:px-4 min-\[2048px\]:h-16 min-\[2048px\]:px-5" style=\{\{ borderColor: "var\(--border-soft\)" \}\}>[\s\S]*?          <\/div>\n\n          <nav/,
    `          <div
            className="flex h-14 flex-shrink-0 items-center justify-center border-b px-1.5 lg:h-16 lg:px-2 min-[2048px]:h-20 min-[2048px]:px-3"
            style={{ borderColor: "var(--border-soft)" }}
          >
            <EduAIBrand
              className="w-full"
              logoClassName={
                expanded
                  ? "h-8 w-8 lg:h-9 lg:w-9 min-[2048px]:h-11 min-[2048px]:w-11"
                  : "h-7 w-7 lg:h-8 lg:w-8 min-[2048px]:h-9 min-[2048px]:w-9"
              }
              nameClassName={
                expanded
                  ? "text-[11px] font-extrabold tracking-tight text-main lg:text-xs min-[2048px]:text-sm"
                  : "text-[9px] font-extrabold tracking-tight text-main lg:text-[10px] min-[2048px]:text-[11px]"
              }
            />
          </div>

          <nav`,
    "bloque de marca del dashboard",
  )

  save(path, source)
}

function patchLogin() {
  const path = "app/(auth)/login/page.tsx"
  let source = load(path)
  if (source.includes(MARKER)) return

  source = replaceRequired(
    source,
    'import { Zap, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react"',
    'import { Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react"',
    "iconos del login",
  )
  source = replaceRequired(
    source,
    'import LegalFooter from "@/components/legal/LegalFooter"',
    [
      'import LegalFooter from "@/components/legal/LegalFooter"',
      'import EduAIBrand from "@/components/branding/EduAIBrand"',
      `// ${MARKER}`,
    ].join("\n"),
    "import de marca del login",
  )

  source = replaceRegexRequired(
    source,
    /        <div className="text-center mb-8">[\s\S]*?        <\/div>\n\n        <div className="rounded-2xl p-6 border"/,
    `        <div className="mb-8 text-center">
          <EduAIBrand
            className="w-full"
            logoClassName="h-20 w-20"
            nameClassName="text-3xl font-bold tracking-tight text-main"
          />
          <p className="mt-2 text-sm text-muted2">Tu tutor personal con IA</p>
        </div>

        <div className="rounded-2xl p-6 border"`,
    "logo del login",
  )

  save(path, source)
}

function patchRegister() {
  const path = "app/(auth)/register/page.tsx"
  let source = load(path)
  if (source.includes(MARKER)) return

  source = replaceRequired(
    source,
    'import { Zap, User, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react"',
    'import { User, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react"',
    "iconos del registro",
  )
  source = replaceRequired(
    source,
    'import Link from "next/link"',
    [
      'import Link from "next/link"',
      'import EduAIBrand from "@/components/branding/EduAIBrand"',
      `// ${MARKER}`,
    ].join("\n"),
    "import de marca del registro",
  )

  source = replaceRegexRequired(
    source,
    /        \{\/\* Logo \*\/\}\n        <div className="text-center mb-8">[\s\S]*?        <\/div>\n\n        \{\/\* Card \*\/\}/,
    `        {/* Logo */}
        <div className="mb-8 text-center">
          <EduAIBrand
            className="w-full"
            logoClassName="h-20 w-20"
            nameClassName="text-3xl font-bold tracking-tight text-main"
          />
          <p className="mt-2 text-sm text-muted2">Crea tu cuenta gratis</p>
        </div>

        {/* Card */}`,
    "logo del registro",
  )

  save(path, source)
}

patchDashboard()
patchLogin()
patchRegister()
console.log("[eduai-brand] SVG animado + nombre EduAI aplicados en dashboard, login y registro")
