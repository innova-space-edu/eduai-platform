import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

const root = process.cwd()
const applyPath = path.join(root, "scripts/apply-deep-research-work-ui.mjs")
const filePath = path.join(root, "components/work/WorkChat.tsx")

for (let i = 0; i < 2; i += 1) {
  const run = spawnSync(process.execPath, [applyPath], { cwd: root, encoding: "utf8" })
  if (run.status !== 0) throw new Error(`[test-deep-research-work-ui] apply run ${i + 1} failed: ${run.stderr || run.stdout}`)
}

const source = fs.readFileSync(filePath, "utf8")
const count = (needle) => source.split(needle).length - 1

if (count("const [deepResearchMode, setDeepResearchMode] = useState(false)") !== 1) {
  throw new Error("[test-deep-research-work-ui] Deep Research mode state missing or duplicated")
}
if (count('fetch("/api/work/deep-research"') !== 1 || !source.includes('/api/work/deep-research?id=')) {
  throw new Error("[test-deep-research-work-ui] start/poll Deep Research flow missing")
}
if (!source.includes('fetch("/api/work/research"')) {
  throw new Error("[test-deep-research-work-ui] fast research path must remain intact")
}
if (!source.includes("await waitForResearchPoll(5_000, signal)")) {
  throw new Error("[test-deep-research-work-ui] browser polling cadence missing")
}
if (!source.includes("setDeepResearchMode((current) => !current)") || !source.includes('{deepResearchMode ? "Profunda" : "Rápida"}')) {
  throw new Error("[test-deep-research-work-ui] visible fast/deep selector missing")
}
if (!source.includes("Investigación profunda en curso…")) {
  throw new Error("[test-deep-research-work-ui] Deep Research progress label missing")
}
if (!source.includes("Google Deep Research") || !source.includes("deep research reutilizado")) {
  throw new Error("[test-deep-research-work-ui] completed/reused result labeling missing")
}
if (!source.includes("abortRef.current.signal")) {
  throw new Error("[test-deep-research-work-ui] stop/abort integration missing")
}

console.log("[test-deep-research-work-ui] fast research preserved; optional Deep Research uses abortable polling and existing result UI")
