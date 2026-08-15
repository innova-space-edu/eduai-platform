import fs from "node:fs"
import path from "node:path"

const routePath = path.join(process.cwd(), "app/api/agents/video/status/[jobId]/route.ts")

if (!fs.existsSync(routePath)) {
  throw new Error("[test-video-preview-autostart] status route not found")
}

const source = fs.readFileSync(routePath, "utf8")

const required = [
  "[Video status][autostart]",
  'if (current.status === "queued")',
  '.eq("status", "queued")',
  'status: "processing"',
  "operation_name: result.operationName",
  "await processVideoJob({",
]

for (const marker of required) {
  if (!source.includes(marker)) {
    throw new Error(`[test-video-preview-autostart] missing marker: ${marker}`)
  }
}

console.log("[test-video-preview-autostart] queued jobs start from authenticated status polling")
