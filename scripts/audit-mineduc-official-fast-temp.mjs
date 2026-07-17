import { readFileSync } from "node:fs"

const path = new URL("./audit-mineduc-official-node-temp.mjs", import.meta.url)
let source = readFileSync(path, "utf8")
source = source
  .replace("AbortSignal.timeout(25000)", "AbortSignal.timeout(8000)")
  .replace("i += 4", "i += 20")
  .replace("files.slice(i,i+4)", "files.slice(i,i+20)")

await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`)
