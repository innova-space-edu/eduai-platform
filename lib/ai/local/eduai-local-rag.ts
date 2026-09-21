export type EduAIKnowledgeRecord = {
  id: string;
  source: string;
  language: string;
  content: string;
};

export type EduAIKnowledgePack = {
  schemaVersion: number;
  generatedAt: string;
  buildCommit: string;
  records: EduAIKnowledgeRecord[];
};

export type EduAIKnowledgeIndex = {
  schemaVersion: number;
  sourceProfile?: string;
  generatedAt: string;
  buildCommit: string;
  totalRecords: number;
  totalBytes: number;
  shards: Array<{
    index: number;
    file: string;
    records: number;
    bytes: number;
  }>;
};

export type EduAIKnowledgeState = {
  installed: boolean;
  records: number;
  generatedAt: string | null;
  buildCommit: string | null;
  sizeBytes: number;
};

export type EduAIKnowledgeHit = {
  source: string;
  snippet: string;
  score: number;
};

export type EduAIKnowledgeInstallProgress = {
  stage: "index" | "download" | "store";
  completedShards: number;
  totalShards: number;
  downloadedBytes: number;
  totalBytes: number;
};

const DB_NAME = "eduai-local-ai-v1";
const DB_VERSION = 1;
const STORE = "knowledge";
const PACK_KEY = "repository-pack";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("No se pudo abrir IndexedDB."));
  });
}

async function readPack(): Promise<EduAIKnowledgePack | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).get(PACK_KEY);
      request.onsuccess = () => resolve((request.result as EduAIKnowledgePack | undefined) || null);
      request.onerror = () => reject(request.error || new Error("No se pudo leer el Knowledge Pack."));
    });
  } finally {
    db.close();
  }
}

async function writePack(pack: EduAIKnowledgePack) {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(pack, PACK_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("No se pudo guardar el Knowledge Pack."));
    });
  } finally {
    db.close();
  }
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function queryTerms(query: string) {
  const stop = new Set(["como", "donde", "para", "esta", "este", "esto", "desde", "sobre", "entre", "cual", "cuando", "porque", "que", "del", "los", "las", "una", "uno", "con", "por"]);
  return [...new Set(
    normalize(query)
      .split(/[^a-z0-9_./-]+/)
      .map((term) => term.trim())
      .filter((term) => term.length >= 3 && !stop.has(term)),
  )].slice(0, 12);
}

function estimateBytes(pack: EduAIKnowledgePack) {
  try {
    return new Blob([JSON.stringify(pack)]).size;
  } catch {
    return 0;
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    throw new Error(data?.error || "No se pudo descargar el Knowledge Pack.");
  }
  return data as T;
}

export async function installEduAILocalKnowledgePack(
  onProgress?: (progress: EduAIKnowledgeInstallProgress) => void,
): Promise<EduAIKnowledgeState> {
  onProgress?.({ stage: "index", completedShards: 0, totalShards: 0, downloadedBytes: 0, totalBytes: 0 });
  const index = await fetchJson<EduAIKnowledgeIndex>("/api/admin/ai-core/local-knowledge-pack");
  if (!Array.isArray(index.shards) || !index.shards.length) {
    throw new Error("El Knowledge Pack no contiene shards.");
  }

  const records: EduAIKnowledgeRecord[] = [];
  let downloadedBytes = 0;

  for (let position = 0; position < index.shards.length; position += 1) {
    const shardMeta = index.shards[position];
    onProgress?.({
      stage: "download",
      completedShards: position,
      totalShards: index.shards.length,
      downloadedBytes,
      totalBytes: index.totalBytes,
    });
    const shard = await fetchJson<{
      schemaVersion: number;
      generatedAt: string;
      buildCommit: string;
      index: number;
      records: EduAIKnowledgeRecord[];
    }>(`/api/admin/ai-core/local-knowledge-pack?shard=${shardMeta.index}`);

    if (shard.buildCommit !== index.buildCommit) {
      throw new Error("El Knowledge Pack cambió durante la descarga. Vuelve a intentarlo.");
    }
    records.push(...(shard.records || []));
    downloadedBytes += shardMeta.bytes;
  }

  if (records.length !== index.totalRecords) {
    throw new Error(`Knowledge Pack incompleto: ${records.length}/${index.totalRecords} chunks.`);
  }

  onProgress?.({
    stage: "store",
    completedShards: index.shards.length,
    totalShards: index.shards.length,
    downloadedBytes,
    totalBytes: index.totalBytes,
  });

  const pack: EduAIKnowledgePack = {
    schemaVersion: index.schemaVersion,
    generatedAt: index.generatedAt,
    buildCommit: index.buildCommit,
    records,
  };
  await writePack(pack);

  return {
    installed: true,
    records: pack.records.length,
    generatedAt: pack.generatedAt || null,
    buildCommit: pack.buildCommit || null,
    sizeBytes: estimateBytes(pack),
  };
}

export async function getEduAILocalKnowledgeState(): Promise<EduAIKnowledgeState> {
  const pack = await readPack();
  if (!pack) {
    return { installed: false, records: 0, generatedAt: null, buildCommit: null, sizeBytes: 0 };
  }
  return {
    installed: true,
    records: pack.records.length,
    generatedAt: pack.generatedAt || null,
    buildCommit: pack.buildCommit || null,
    sizeBytes: estimateBytes(pack),
  };
}

export async function clearEduAILocalKnowledgePack() {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(PACK_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("No se pudo borrar el Knowledge Pack."));
    });
  } finally {
    db.close();
  }
}

export async function searchEduAILocalKnowledgePack(
  query: string,
  limit = 4,
): Promise<EduAIKnowledgeHit[]> {
  const pack = await readPack();
  if (!pack?.records?.length) return [];

  const terms = queryTerms(query);
  if (!terms.length) return [];

  const scored: EduAIKnowledgeHit[] = [];
  for (let index = 0; index < pack.records.length; index += 1) {
    const record = pack.records[index];
    const source = normalize(record.source);
    const content = normalize(record.content);
    let score = 0;

    for (const term of terms) {
      if (source.includes(term)) score += 8;
      const first = content.indexOf(term);
      if (first >= 0) {
        score += 2;
        const second = content.indexOf(term, first + term.length);
        if (second >= 0) score += 1;
      }
    }

    if (score > 0) {
      const firstTerm = terms.find((term) => content.includes(term));
      const position = firstTerm ? content.indexOf(firstTerm) : 0;
      const start = Math.max(0, position - 280);
      const snippet = record.content.slice(start, start + 1500);
      scored.push({ source: record.source, snippet, score });
    }

    if (index > 0 && index % 250 === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  return scored
    .sort((a, b) => b.score - a.score || a.source.localeCompare(b.source))
    .slice(0, Math.max(1, Math.min(8, limit)));
}
