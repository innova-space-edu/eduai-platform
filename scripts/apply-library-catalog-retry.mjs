import fs from "node:fs"
import path from "node:path"

function replaceExact(source, before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`[library-catalog-retry] expected block not found: ${label}`)
  }
  return source.replace(before, after)
}

const pageTarget = path.join(process.cwd(), "app", "biblioteca", "page.tsx")
let pageSource = fs.readFileSync(pageTarget, "utf8")
const PAGE_MARKER = "// Library catalog retry patch v1"

if (!pageSource.includes(PAGE_MARKER)) {
  pageSource = replaceExact(
    pageSource,
    `  const [catalogError, setCatalogError] = useState("")`,
    `  ${PAGE_MARKER}\n  const [catalogError, setCatalogError] = useState("")\n  const [catalogReload, setCatalogReload] = useState(0)`,
    "reload state",
  )

  pageSource = replaceExact(
    pageSource,
    `  }, [activeCollection, page, searchTerm])`,
    `  }, [activeCollection, catalogReload, page, searchTerm])`,
    "catalog effect dependencies",
  )

  pageSource = replaceExact(
    pageSource,
    `onClick={() => setPage((value) => value)}`,
    `onClick={() => setCatalogReload((value) => value + 1)}`,
    "retry button",
  )

  fs.writeFileSync(pageTarget, pageSource)
  console.log("[library-catalog-retry] functional retry applied")
} else {
  console.log("[library-catalog-retry] retry already applied")
}

const catalogTarget = path.join(process.cwd(), "lib", "library", "catalog.ts")
let catalogSource = fs.readFileSync(catalogTarget, "utf8")
const WORK_KEY_MARKER = "// Library work key patch v1"

if (!catalogSource.includes(WORK_KEY_MARKER)) {
  catalogSource = replaceExact(
    catalogSource,
    `function normalizeWorkKey(key?: string) {\n  if (!key) return ""\n  return key.startsWith("/") ? key : \`/\${key}\`\n}`,
    `${WORK_KEY_MARKER}\nfunction normalizeWorkKey(key?: string) {\n  if (!key) return ""\n  if (key.startsWith("/works/")) return key\n  if (key.startsWith("OL") && key.endsWith("W")) return \`/works/\${key}\`\n  if (key.startsWith("/")) return key\n  return \`/works/\${key}\`\n}`,
    "Open Library work key",
  )

  fs.writeFileSync(catalogTarget, catalogSource)
  console.log("[library-catalog-retry] Open Library work links normalized")
} else {
  console.log("[library-catalog-retry] work links already normalized")
}
