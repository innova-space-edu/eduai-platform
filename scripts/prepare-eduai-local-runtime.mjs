import { access, copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const source = path.join(
  ROOT,
  "node_modules",
  "@wllama",
  "wllama",
  "esm",
  "wasm",
  "wllama.wasm",
);
const targetDir = path.join(ROOT, "public", "eduai-local");
const target = path.join(targetDir, "wllama.wasm");

try {
  await access(source);
} catch {
  throw new Error(
    "No se encontró wllama.wasm en node_modules. Ejecuta npm install antes de preparar EDUAI Local.",
  );
}

await mkdir(targetDir, { recursive: true });
await copyFile(source, target);

const info = await stat(target);
if (info.size < 1024 * 1024) {
  throw new Error(`wllama.wasm parece incompleto: ${info.size} bytes`);
}

console.log(
  JSON.stringify(
    {
      source: path.relative(ROOT, source).replaceAll("\\", "/"),
      target: path.relative(ROOT, target).replaceAll("\\", "/"),
      bytes: info.size,
      runtimeUrl: "/eduai-local/wllama.wasm",
    },
    null,
    2,
  ),
);
