import fs from "node:fs"
import path from "node:path"

const target = path.join(process.cwd(), "app", "biblioteca", "page.tsx")
let source = fs.readFileSync(target, "utf8")

const MARKER = "// Library catalog retry patch v1"
if (source.includes(MARKER)) {
  console.log("[library-catalog-retry] already applied")
  process.exit(0)
}

function replaceExact(before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`[library-catalog-retry] expected block not found: ${label}`)
  }
  source = source.replace(before, after)
}

replaceExact(
  `  const [catalogError, setCatalogError] = useState("")`,
  `  ${MARKER}\n  const [catalogError, setCatalogError] = useState("")\n  const [catalogReload, setCatalogReload] = useState(0)`,
  "reload state",
)

replaceExact(
  `  }, [activeCollection, page, searchTerm])`,
  `  }, [activeCollection, catalogReload, page, searchTerm])`,
  "catalog effect dependencies",
)

replaceExact(
  `onClick={() => setPage((value) => value)}`,
  `onClick={() => setCatalogReload((value) => value + 1)}`,
  "retry button",
)

fs.writeFileSync(target, source)
console.log("[library-catalog-retry] functional retry applied")
