import { writeFileSync } from "node:fs"

const captured = []
const originalLog = console.log
console.log = (...args) => {
  const line = args.map((x) => typeof x === "string" ? x : JSON.stringify(x)).join(" ")
  captured.push(line)
  originalLog(...args)
}

await import("./audit-mineduc-official-fast-temp.mjs")
console.log = originalLog

const start = captured.indexOf("OA_OFFICIAL_AUDIT_START")
const end = captured.indexOf("OA_OFFICIAL_AUDIT_END")
if (start < 0 || end <= start) throw new Error("No se encontró el bloque JSON de auditoría")
const raw = captured.slice(start + 1, end).join("\n")
JSON.parse(raw)
writeFileSync("oa-audit-report.json", raw + "\n", "utf8")
originalLog("OA_AUDIT_ARTIFACT_WRITTEN", raw.length)
