import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const routerPath = path.join(root, "lib/video/personal-video-router.ts")
if (!fs.existsSync(routerPath)) throw new Error("[personal-provider-hardening] router personal no encontrado")

let source = fs.readFileSync(routerPath, "utf8")
let changed = false

const oldVersion = '      body = { version: model.latest_version.id, input: bodyInput }'
const newVersion = '      body = { version: `${owner}/${name}:${model.latest_version.id}`, input: bodyInput }'
if (!source.includes(newVersion)) {
  if (!source.includes(oldVersion)) throw new Error("[personal-provider-hardening] marker de versión Replicate no encontrado")
  source = source.replace(oldVersion, newVersion)
  changed = true
}

if (changed) {
  fs.writeFileSync(routerPath, source)
  console.log("[personal-provider-hardening] Replicate usa owner/model:version")
} else {
  console.log("[personal-provider-hardening] ya aplicado")
}
