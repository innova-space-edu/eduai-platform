import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATASET = path.join(ROOT, "training", "eduai-local", "example-instructions.jsonl");
const PROFILES = path.join(ROOT, "training", "eduai-local", "profiles.json");
const SECRET_LIKE = /(api[_-]?key|secret|password|private[_-]?key|service[_-]?account)\s*[:=]\s*["'][^"']{8,}["']/i;

const raw = await readFile(DATASET, "utf8");
const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

if (lines.length < 10) {
  throw new Error(`Dataset local demasiado pequeño para validar la tubería: ${lines.length} ejemplos`);
}

const seenUserPrompts = new Set();

for (let index = 0; index < lines.length; index += 1) {
  let row;
  try {
    row = JSON.parse(lines[index]);
  } catch (error) {
    throw new Error(`JSONL inválido en línea ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!Array.isArray(row.messages) || row.messages.length < 2) {
    throw new Error(`Línea ${index + 1}: messages debe contener al menos user y assistant`);
  }

  for (const message of row.messages) {
    if (!["system", "user", "assistant"].includes(message?.role)) {
      throw new Error(`Línea ${index + 1}: role inválido`);
    }
    if (typeof message?.content !== "string" || !message.content.trim()) {
      throw new Error(`Línea ${index + 1}: content vacío`);
    }
    if (SECRET_LIKE.test(message.content)) {
      throw new Error(`Línea ${index + 1}: contenido con apariencia de secreto`);
    }
  }

  if (row.messages.at(-1)?.role !== "assistant") {
    throw new Error(`Línea ${index + 1}: el último mensaje debe ser assistant`);
  }

  const user = row.messages.findLast?.((message) => message.role === "user")
    || [...row.messages].reverse().find((message) => message.role === "user");
  if (!user) throw new Error(`Línea ${index + 1}: falta mensaje user`);
  const key = user.content.trim().toLowerCase();
  if (seenUserPrompts.has(key)) throw new Error(`Línea ${index + 1}: prompt user duplicado`);
  seenUserPrompts.add(key);
}

const profiles = JSON.parse(await readFile(PROFILES, "utf8"));
const requiredProfiles = ["eduai-nano", "eduai-lite", "eduai-performance"];
for (const profileId of requiredProfiles) {
  const profile = profiles[profileId];
  if (!profile) throw new Error(`Falta perfil ${profileId}`);
  for (const field of ["label", "baseModel", "output", "targetHardware", "runtimeQuant", "purpose"]) {
    if (typeof profile[field] !== "string" || !profile[field].trim()) {
      throw new Error(`${profileId}: campo inválido ${field}`);
    }
  }
}

console.log(
  `EDUAI local training data: OK (${lines.length} ejemplos, ${requiredProfiles.length} perfiles)`,
);
