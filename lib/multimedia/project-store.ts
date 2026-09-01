import type { MediaAsset, MultimediaProject } from "./types";

const DB_NAME = "eduai-multimedia-projects";
const DB_VERSION = 1;
const STORE_NAME = "projects";

export type PersistableStudioAsset = MediaAsset & {
  mime?: string;
  extension?: string;
  compatibility?: unknown;
  normalizedMime?: boolean;
  downloadUrl?: string;
  width?: number;
  height?: number;
};

type StoredAsset = Omit<PersistableStudioAsset, "url"> & {
  url: string;
  blob?: Blob;
};

type SavedProjectRecord = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  project: MultimediaProject;
  assets: StoredAsset[];
};

export type SavedProjectSummary = Pick<SavedProjectRecord, "id" | "title" | "createdAt" | "updatedAt"> & {
  assetCount: number;
};

export type RestoredProject = {
  id: string;
  project: MultimediaProject;
  assets: PersistableStudioAsset[];
};

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
    transaction.onerror = () => reject(transaction.error || new Error("No se pudo guardar el proyecto."));
    transaction.onabort = () => reject(transaction.error || new Error("El guardado del proyecto fue cancelado."));
  });
}

async function assetToStored(asset: PersistableStudioAsset): Promise<StoredAsset> {
  let blob: Blob | undefined;
  if (asset.local && asset.url) {
    try {
      const response = await fetch(asset.url);
      if (response.ok) blob = await response.blob();
    } catch {
      blob = undefined;
    }
  }

  return {
    ...asset,
    url: asset.local ? "" : asset.url,
    missing: asset.local ? !blob : Boolean(asset.missing),
    blob,
  };
}

export async function listSavedMultimediaProjects(): Promise<SavedProjectSummary[]> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const records = await requestResult(transaction.objectStore(STORE_NAME).getAll()) as SavedProjectRecord[];
    return records
      .map((record) => ({
        id: record.id,
        title: record.title,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        assetCount: record.assets.length,
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } finally {
    database.close();
  }
}

export async function saveMultimediaProject(
  project: MultimediaProject,
  assets: PersistableStudioAsset[],
  existingId?: string | null,
): Promise<SavedProjectSummary> {
  const database = await openDatabase();
  try {
    const id = existingId || `saved-${crypto.randomUUID()}`;
    let existing: SavedProjectRecord | undefined;
    if (existingId) {
      const read = database.transaction(STORE_NAME, "readonly");
      existing = await requestResult(read.objectStore(STORE_NAME).get(existingId)) as SavedProjectRecord | undefined;
    }

    const now = new Date().toISOString();
    const storedAssets = await Promise.all(assets.map(assetToStored));
    const record: SavedProjectRecord = {
      id,
      title: project.title || "Proyecto multimedia",
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      project: { ...project, updatedAt: now },
      assets: storedAssets,
    };

    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(record);
    await transactionDone(transaction);

    return {
      id: record.id,
      title: record.title,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      assetCount: record.assets.length,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      throw new Error("No hay espacio suficiente en este navegador para guardar el proyecto con sus archivos multimedia.");
    }
    throw error;
  } finally {
    database.close();
  }
}

export async function loadMultimediaProject(id: string): Promise<RestoredProject> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const record = await requestResult(transaction.objectStore(STORE_NAME).get(id)) as SavedProjectRecord | undefined;
    if (!record) throw new Error("El proyecto guardado ya no existe.");

    const assets = record.assets.map((asset) => {
      const { blob, ...stored } = asset;
      if (stored.local && blob) {
        return { ...stored, url: URL.createObjectURL(blob), missing: false } as PersistableStudioAsset;
      }
      return { ...stored, missing: Boolean(stored.local) || Boolean(stored.missing) } as PersistableStudioAsset;
    });

    return {
      id: record.id,
      project: structuredClone(record.project),
      assets,
    };
  } finally {
    database.close();
  }
}

export async function deleteMultimediaProject(id: string) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}
