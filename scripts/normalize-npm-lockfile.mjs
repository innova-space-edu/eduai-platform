import { existsSync, readFileSync, writeFileSync } from "node:fs"

const lockfilePath = new URL("../package-lock.json", import.meta.url)

if (!existsSync(lockfilePath)) {
  console.log("[normalize-npm-lockfile] package-lock.json not found; skipping.")
  process.exit(0)
}

const privateRegistryPrefix = "https://packages.applied-caas-gateway1.internal.api.openai.org/artifactory/api/npm/npm-public/"
const publicRegistryPrefix = "https://registry.npmjs.org/"

const original = readFileSync(lockfilePath, "utf8")
const matches = original.split(privateRegistryPrefix).length - 1

if (matches === 0) {
  console.log("[normalize-npm-lockfile] lockfile already uses public registry URLs.")
  process.exit(0)
}

const normalized = original.replaceAll(privateRegistryPrefix, publicRegistryPrefix)
writeFileSync(lockfilePath, normalized, "utf8")
console.log(`[normalize-npm-lockfile] replaced ${matches} private registry URL(s) with ${publicRegistryPrefix}`)
