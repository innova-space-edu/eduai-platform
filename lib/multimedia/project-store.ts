import type { MediaAsset, MultimediaProject } from "./types";

const DB_NAME = "eduai-multimedia-projects";
const DB_VERSION = 2;
const STORE_NAME = "projects";
const FOLDER_STORE = "folders";

export type PersistableStudioAsset = MediaAsset & {
  mime?: string;
  extension?: string;
  compatibility?: unknown;
  normalizedMime?: boolean;
  downloadUrl?: string;
  width?: number;
  height?: number;
};

type StoredAsset = Omit<PersistableStudioAsset, "url"> & { url: string; blob?: Blob };
type SavedProjectRecord = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  folderId: string | null;
  project: MultimediaProject;
  assets: StoredAsset[];
};

export type SavedProjectSummary = Pick<SavedProjectRecord, "id" | "title" | "createdAt" | "updatedAt" | "folderId"> & { assetCount: number };
export type MultimediaProjectFolder = { id: string; name: string; createdAt: string; updatedAt: string };
export type RestoredProject = { id: string; folderId: string | null; project: MultimediaProject; assets: PersistableStudioAsset[] };

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error || new Error("No se pudo abrir el almacenamiento de proyectos."));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
      if (!database.objectStoreNames.contains(FOLDER_STORE)) {
        const store = database.createObjectStore(FOLDER_STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onerror = () => reject(request.error || new Error("La operación de almacenamiento falló."));
    request.onsuccess = () => resolve(request.result);
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("No se pudo completar la operación."));
    transaction.onabort = () => reject(transaction.error || new Error("La operación fue cancelada."));
  });
}

async function assetToStored(asset: PersistableStudioAsset, previous?: StoredAsset): Promise<StoredAsset> {
  let blob: Blob | undefined = previous?.blob;
  if (asset.local && asset.url && !blob) {
    try {
      const response = await fetch(asset.url);
      if (response.ok) blob = await response.blob();
    } catch {
      blob = undefined;
    }
  }
  return { ...asset, url: asset.local ? "" : asset.url, missing: asset.local ? !blob : Boolean(asset.missing), blob };
}

export async function listSavedMultimediaProjects(): Promise<SavedProjectSummary[]> {
  const database = await openDatabase();
  try {
    const tx = database.transaction(STORE_NAME, "readonly");
    const records = await requestResult(tx.objectStore(STORE_NAME).getAll()) as SavedProjectRecord[];
    return records.map((record) => ({ id: record.id, title: record.title, createdAt: record.createdAt, updatedAt: record.updatedAt, folderId: record.folderId || null, assetCount: record.assets.length })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } finally { database.close(); }
}

export async function listMultimediaProjectFolders(): Promise<MultimediaProjectFolder[]> {
  const database = await openDatabase();
  try {
    const tx = database.transaction(FOLDER_STORE, "readonly");
    const folders = await requestResult(tx.objectStore(FOLDER_STORE).getAll()) as MultimediaProjectFolder[];
    return folders.sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
  } finally { database.close(); }
}

export async function createMultimediaProjectFolder(name: string) {
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!clean) throw new Error("Escribe un nombre para la carpeta.");
  const database = await openDatabase();
  try {
    const now = new Date().toISOString();
    const folder: MultimediaProjectFolder = { id: `folder-${crypto.randomUUID()}`, name: clean, createdAt: now, updatedAt: now };
    const tx = database.transaction(FOLDER_STORE, "readwrite");
    tx.objectStore(FOLDER_STORE).put(folder);
    await transactionDone(tx);
    return folder;
  } finally { database.close(); }
}

export async function deleteMultimediaProjectFolder(id: string) {
  const database = await openDatabase();
  try {
    const tx = database.transaction([FOLDER_STORE, STORE_NAME], "readwrite");
    tx.objectStore(FOLDER_STORE).delete(id);
    const projects = await requestResult(tx.objectStore(STORE_NAME).getAll()) as SavedProjectRecord[];
    for (const project of projects) if (project.folderId === id) tx.objectStore(STORE_NAME).put({ ...project, folderId: null, updatedAt: new Date().toISOString() });
    await transactionDone(tx);
  } finally { database.close(); }
}

export async function saveMultimediaProject(project: MultimediaProject, assets: PersistableStudioAsset[], existingId?: string | null, folderId?: string | null): Promise<SavedProjectSummary> {
  const database = await openDatabase();
  try {
    const id = existingId || `saved-${crypto.randomUUID()}`;
    let existing: SavedProjectRecord | undefined;
    if (existingId) {
      const read = database.transaction(STORE_NAME, "readonly");
      existing = await requestResult(read.objectStore(STORE_NAME).get(existingId)) as SavedProjectRecord | undefined;
    }
    const now = new Date().toISOString();
    const previousAssets = new Map((existing?.assets || []).map((asset) => [asset.id, asset]));
    const storedAssets = await Promise.all(assets.map((asset) => assetToStored(asset, previousAssets.get(asset.id))));
    const record: SavedProjectRecord = { id, title: project.title || "Proyecto multimedia", createdAt: existing?.createdAt || now, updatedAt: now, folderId: folderId === undefined ? existing?.folderId || null : folderId, project: { ...project, updatedAt: now }, assets: storedAssets };
    const tx = database.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    await transactionDone(tx);
    return { id: record.id, title: record.title, createdAt: record.createdAt, updatedAt: record.updatedAt, folderId: record.folderId, assetCount: record.assets.length };
  } catch (error) {
    if (error instanceof DOMException && error.name === "QuotaExceededError") throw new Error("No hay espacio suficiente en este navegador para guardar el proyecto con sus archivos multimedia.");
    throw error;
  } finally { database.close(); }
}

export async function moveMultimediaProjectToFolder(id: string, folderId: string | null) {
  const database = await openDatabase();
  try {
    const read = database.transaction(STORE_NAME, "readonly");
    const record = await requestResult(read.objectStore(STORE_NAME).get(id)) as SavedProjectRecord | undefined;
    if (!record) throw new Error("El proyecto guardado ya no existe.");
    const tx = database.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({ ...record, folderId, updatedAt: new Date().toISOString() });
    await transactionDone(tx);
  } finally { database.close(); }
}

export async function loadMultimediaProject(id: string): Promise<RestoredProject> {
  const database = await openDatabase();
  try {
    const tx = database.transaction(STORE_NAME, "readonly");
    const record = await requestResult(tx.objectStore(STORE_NAME).get(id)) as SavedProjectRecord | undefined;
    if (!record) throw new Error("El proyecto guardado ya no existe.");
    const assets = record.assets.map((asset) => {
      const { blob, ...stored } = asset;
      if (stored.local && blob) return { ...stored, url: URL.createObjectURL(blob), missing: false } as PersistableStudioAsset;
      return { ...stored, missing: Boolean(stored.local) || Boolean(stored.missing) } as PersistableStudioAsset;
    });
    return { id: record.id, folderId: record.folderId || null, project: structuredClone(record.project), assets };
  } finally { database.close(); }
}

export async function deleteMultimediaProject(id: string) {
  const database = await openDatabase();
  try {
    const tx = database.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    await transactionDone(tx);
  } finally { database.close(); }
}

export async function clearMultimediaProjects() {
  const database = await openDatabase();
  try {
    const tx = database.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    await transactionDone(tx);
  } finally { database.close(); }
}
