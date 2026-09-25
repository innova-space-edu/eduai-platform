export type EduAIGgufFileLike = {
  name: string;
  size: number;
};

export type EduAIGgufSelection<T extends EduAIGgufFileLike> = {
  files: T[];
  totalBytes: number;
  shardCount: number;
  label: string;
};

const SHARD_RE = /^(.*)-(\d{5})-of-(\d{5})\.gguf$/i;

export function validateEduAIGgufFiles<T extends EduAIGgufFileLike>(
  input: T[],
): EduAIGgufSelection<T> {
  if (!input.length) throw new Error("Selecciona al menos un archivo GGUF.");

  const files = [...input];
  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(".gguf")) {
      throw new Error(`Archivo no GGUF: ${file.name}`);
    }
    if (!Number.isFinite(file.size) || file.size <= 0) {
      throw new Error(`Archivo vacío o inválido: ${file.name}`);
    }
  }

  if (files.length === 1) {
    return {
      files,
      totalBytes: files[0].size,
      shardCount: 1,
      label: files[0].name.replace(/\.gguf$/i, ""),
    };
  }

  const parsed = files.map((file) => {
    const match = file.name.match(SHARD_RE);
    if (!match) {
      throw new Error(
        "Si seleccionas varios GGUF, deben ser shards con formato -00001-of-000NN.gguf.",
      );
    }
    return {
      file,
      prefix: match[1],
      index: Number(match[2]),
      total: Number(match[3]),
    };
  });

  const prefix = parsed[0].prefix;
  const total = parsed[0].total;
  if (total !== files.length) {
    throw new Error(`Conjunto incompleto: se esperan ${total} shards y seleccionaste ${files.length}.`);
  }
  if (parsed.some((item) => item.prefix !== prefix || item.total !== total)) {
    throw new Error("Los shards seleccionados no pertenecen al mismo modelo.");
  }

  const indexes = new Set(parsed.map((item) => item.index));
  for (let index = 1; index <= total; index += 1) {
    if (!indexes.has(index)) throw new Error(`Falta el shard ${String(index).padStart(5, "0")}.`);
  }

  parsed.sort((a, b) => a.index - b.index);
  return {
    files: parsed.map((item) => item.file),
    totalBytes: parsed.reduce((sum, item) => sum + item.file.size, 0),
    shardCount: total,
    label: prefix,
  };
}
