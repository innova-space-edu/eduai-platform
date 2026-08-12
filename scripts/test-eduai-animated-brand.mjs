import { existsSync, readFileSync } from "node:fs"

function assert(condition, message) {
  if (!condition) throw new Error(`[test-eduai-brand] ${message}`)
}

const svgPath = "public/eduai-logo.svg"
assert(existsSync(svgPath), "falta public/eduai-logo.svg")
const svg = readFileSync(svgPath, "utf8")
assert(svg.includes('<svg width="110" height="110"'), "el SVG oficial no conserva su viewBox/tamaño base")
assert((svg.match(/repeatCount="indefinite"/g) || []).length >= 6, "el logo perdió sus animaciones infinitas")
assert(svg.includes('stroke="url(#rainbow)"'), "el logo perdió el gradiente animado")

const brand = readFileSync("components/branding/EduAIBrand.tsx", "utf8")
assert(brand.includes('src="/eduai-logo.svg"'), "el componente no usa el SVG oficial")
assert(brand.includes("EduAI"), "el nombre EduAI debe mostrarse siempre debajo del logo")
assert(!brand.includes("next/image"), "el SVG debe servirse directamente para conservar la animación")

for (const path of [
  "app/dashboard/page.tsx",
  "app/(auth)/login/page.tsx",
  "app/(auth)/register/page.tsx",
]) {
  const source = readFileSync(path, "utf8")
  assert(source.includes("EDUAI_ANIMATED_BRAND_V1"), `${path} no recibió la marca animada`)
  assert(source.includes("<EduAIBrand"), `${path} no renderiza EduAIBrand`)
}

console.log("[test-eduai-brand] logo SVG animado y nombre EduAI verificados")
