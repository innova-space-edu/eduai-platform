import fs from "node:fs"
import path from "node:path"

const gatewayPath = path.join(process.cwd(), "lib/ai/gateway.ts")
let source = fs.readFileSync(gatewayPath, "utf8")

const doneMarker = "const modelCloudResponse = await generateVertexModelCloudText({"
if (source.includes(doneMarker)) {
  console.log("[vertex-model-cloud-stream] already applied")
  process.exit(0)
}

if (!source.includes('from "./providers/vertex-model-cloud"')) {
  throw new Error("[vertex-model-cloud-stream] Vertex Model Cloud debe aplicarse antes del fallback streaming")
}

const before = `        return streamGoogleText({\n          messages: input.messages,\n          maxOutputTokens: input.maxOutputTokens,\n          lite: input.lite,\n          model: selected.model,\n        })\n      }\n\n      if (hasCompatibleProvider(provider)) {`

const after = `        return streamGoogleText({\n          messages: input.messages,\n          maxOutputTokens: input.maxOutputTokens,\n          lite: input.lite,\n          model: selected.model,\n        })\n      }\n\n      if (provider === "vertex-model-cloud" && hasVertexModelCloud()) {\n        const selected = await providerRuntimeModel({\n          supabase: input.supabase,\n          provider: "vertex-model-cloud",\n          capability: "text",\n        })\n        if (!selected) continue\n        const modelCloudResponse = await generateVertexModelCloudText({\n          messages: input.messages,\n          model: selected.model,\n          maxOutputTokens: input.maxOutputTokens,\n        })\n        const encoder = new TextEncoder()\n        return new ReadableStream<Uint8Array>({\n          start(controller) {\n            controller.enqueue(encoder.encode(modelCloudResponse.text))\n            controller.close()\n          },\n        })\n      }\n\n      if (hasCompatibleProvider(provider)) {`

if (!source.includes(before)) {
  throw new Error("[vertex-model-cloud-stream] no se encontró el bloque de streaming de Google")
}

source = source.replace(before, after)
fs.writeFileSync(gatewayPath, source)
console.log("[vertex-model-cloud-stream] Model Cloud participa en streamAIText como fallback de bloque único")
