import { createClient } from "@/lib/supabase/client";
import type { MediaAsset, MultimediaProject } from "./types";

const DB_NAME = "eduai-multimedia-projects";
const DB_VERSION = 2;
const STORE_NAME = "projects";
const FOLDER_STORE = "folders";
const CLOUD_BUCKET = "multimedia-projects";
const ACTIVE_PROJECT_KEY = "eduai.multimedia.active-project.v1";
const HIDDEN_ASSETS_KEY = "eduai.multimedia.hidden-assets.v1";

export type PersistableStudioAsset = MediaAsset & {
  mime?: string;
  extension?: string;
  compatibility?: unknown;
  normalizedMime?: boolean;
  downloadUrl?: string;
  width?: number;
  height?: number;
  cloudPath?: string;
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

type CloudProjectRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  folder_id: string | null;
  project: MultimediaProject;
  assets: PersistableStudioAsset[];
};

type ActiveProjectPointer = { savedId: string; projectId: string };

export type SavedProjectSummary = Pick<SavedProjectRecord, "id" | "title" | "createdAt" | "updatedAt" | "folderId"> & {
  assetCount: number;
  storage?: "cloud" | "local";
};
export type MultimediaProjectFolder = { id: string; name: string; createdAt: string; updatedAt: string; storage?: "cloud" | "local" };
export type RestoredProject = { id: string; folderId: string | null; project: MultimediaProject; assets: PersistableStudioAsset[]; storage?: "cloud" | "local" };

function isBrowser() {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

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

function safeStorageName(value: string) {
  const normalized = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  return normalized.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "recurso";
}

function getHiddenAssetNames() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HIDDEN_ASSETS_KEY) || "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function referencedAssetIds(project: MultimediaProject) {
  return new Set(
    project.tracks.flatMap((track) => track.clips.map((clip) => clip.assetId).filter((assetId): assetId is string => Boolean(assetId))),
  );
}

function assetsForPersistence(project: MultimediaProject, assets: PersistableStudioAsset[]) {
  const hidden = getHiddenAssetNames();
  const referenced = referencedAssetIds(project);
  return assets.filter((asset) => !hidden.has(asset.name) || referenced.has(asset.id));
}

function getActiveProjectPointer(): ActiveProjectPointer | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ACTIVE_PROJECT_KEY) || "null");
    if (parsed?.savedId && parsed?.projectId) return parsed as ActiveProjectPointer;
  } catch {
    // Ignore a malformed pointer.
  }
  return null;
}

function setActiveProjectPointer(savedId: string, projectId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVE_PROJECT_KEY, JSON.stringify({ savedId, projectId } satisfies ActiveProjectPointer));
}

function clearActiveProjectPointer(savedId?: string) {
  if (typeof window === "undefined") return;
  if (!savedId) {
    window.localStorage.removeItem(ACTIVE_PROJECT_KEY);
    return;
  }
  const active = getActiveProjectPointer();
  if (active?.savedId === savedId) window.localStorage.removeItem(ACTIVE_PROJECT_KEY);
}

async function cloudContext() {
  try {
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return { supabase, user };
  } catch {
    return null;
  }
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

async function listLocalProjects(): Promise<SavedProjectSummary[]> {
  if (!isBrowser()) return [];
  const database = await openDatabase();
  try {
    const tx = database.transaction(STORE_NAME, "readonly");
    const records = await requestResult(tx.objectStore(STORE_NAME).getAll()) as SavedProjectRecord[];
    return records.map((record) => ({
      id: record.id,
      title: record.title,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      folderId: record.folderId || null,
      assetCount: record.assets.length,
      storage: "local" as const,
    })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } finally { database.close(); }
}

async function listLocalFolders(): Promise<MultimediaProjectFolder[]> {
  if (!isBrowser()) return [];
  const database = await openDatabase();
  try {
    const tx = database.transaction(FOLDER_STORE, "readonly");
    const folders = await requestResult(tx.objectStore(FOLDER_STORE).getAll()) as MultimediaProjectFolder[];
    return folders.map((folder) => ({ ...folder, storage: "local" as const })).sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
  } finally { database.close(); }
}

async function putLocalFolder(folder: MultimediaProjectFolder) {
  if (!isBrowser()) return;
  const database = await openDatabase();
  try {
    const tx = database.transaction(FOLDER_STORE, "readwrite");
    tx.objectStore(FOLDER_STORE).put({ ...folder, storage: undefined });
    await transactionDone(tx);
  } finally { database.close(); }
}

async function saveLocalProject(project: MultimediaProject, assets: PersistableStudioAsset[], id: string, folderId?: string | null): Promise<SavedProjectSummary> {
  if (!isBrowser()) {
    const now = new Date().toISOString();
    return { id, title: project.title || "Proyecto multimedia", createdAt: now, updatedAt: now, folderId: folderId || null, assetCount: assets.length, storage: "local" };
  }
  const database = await openDatabase();
  try {
    let existing: SavedProjectRecord | undefined;
    const read = database.transaction(STORE_NAME, "readonly");
    existing = await requestResult(read.objectStore(STORE_NAME).get(id)) as SavedProjectRecord | undefined;
    const now = new Date().toISOString();
    const previousAssets = new Map((existing?.assets || []).map((asset) => [asset.id, asset]));
    const storedAssets = await Promise.all(assets.map((asset) => assetToStored(asset, previousAssets.get(asset.id))));
    const record: SavedProjectRecord = {
      id,
      title: project.title || "Proyecto multimedia",
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      folderId: folderId === undefined ? existing?.folderId || null : folderId,
      project: { ...project, updatedAt: now },
      assets: storedAssets,
    };
    const tx = database.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    await transactionDone(tx);
    return { id: record.id, title: record.title, createdAt: record.createdAt, updatedAt: record.updatedAt, folderId: record.folderId, assetCount: record.assets.length, storage: "local" };
  } catch (error) {
    if (error instanceof DOMException && error.name === "QuotaExceededError") throw new Error("No hay espacio suficiente en este navegador para guardar el proyecto con sus archivos multimedia.");
    throw error;
  } finally { database.close(); }
}

async function loadLocalProject(id: string): Promise<RestoredProject> {
  if (!isBrowser()) throw new Error("El almacenamiento local no está disponible.");
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
    setActiveProjectPointer(record.id, record.project.id);
    return { id: record.id, folderId: record.folderId || null, project: structuredClone(record.project), assets, storage: "local" };
  } finally { database.close(); }
}

async function deleteLocalProject(id: string) {
  if (!isBrowser()) return;
  const database = await openDatabase();
  try {
    const tx = database.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    await transactionDone(tx);
  } finally { database.close(); }
}

async function clearLocalProjects() {
  if (!isBrowser()) return;
  const database = await openDatabase();
  try {
    const tx = database.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    await transactionDone(tx);
  } finally { database.close(); }
}

async function deleteCloudFilesForProject(supabase: ReturnType<typeof createClient>, userId: string, projectId: string) {
  const prefix = `${userId}/${projectId}`;
  const { data } = await supabase.storage.from(CLOUD_BUCKET).list(prefix, { limit: 1000 });
  const paths = (data || []).filter((item) => item.name && item.id).map((item) => `${prefix}/${item.name}`);
  if (paths.length) await supabase.storage.from(CLOUD_BUCKET).remove(paths);
}

export async function listSavedMultimediaProjects(): Promise<SavedProjectSummary[]> {
  const local = await listLocalProjects();
  const ctx = await cloudContext();
  if (!ctx) return local;

  const { data, error } = await ctx.supabase
    .from("multimedia_projects")
    .select("id,title,created_at,updated_at,folder_id,assets")
    .eq("user_id", ctx.user.id)
    .order("updated_at", { ascending: false });
  if (error) return local;

  const cloud = (data || []).map((row: any) => ({
    id: row.id as string,
    title: row.title as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    folderId: (row.folder_id as string | null) || null,
    assetCount: Array.isArray(row.assets) ? row.assets.length : 0,
    storage: "cloud" as const,
  }));
  const seen = new Set(cloud.map((item) => item.id));
  return [...cloud, ...local.filter((item) => !seen.has(item.id))].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function listMultimediaProjectFolders(): Promise<MultimediaProjectFolder[]> {
  const local = await listLocalFolders();
  const ctx = await cloudContext();
  if (!ctx) return local;
  const { data, error } = await ctx.supabase
    .from("multimedia_project_folders")
    .select("id,name,created_at,updated_at")
    .eq("user_id", ctx.user.id)
    .order("name", { ascending: true });
  if (error) return local;
  const cloud = (data || []).map((row: any) => ({ id: row.id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at, storage: "cloud" as const }));
  const seen = new Set(cloud.map((item) => item.id));
  return [...cloud, ...local.filter((item) => !seen.has(item.id))].sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
}

export async function createMultimediaProjectFolder(name: string) {
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!clean) throw new Error("Escribe un nombre para la carpeta.");
  const now = new Date().toISOString();
  const folder: MultimediaProjectFolder = { id: `folder-${crypto.randomUUID()}`, name: clean, createdAt: now, updatedAt: now };
  await putLocalFolder(folder);

  const ctx = await cloudContext();
  if (ctx) {
    const { error } = await ctx.supabase.from("multimedia_project_folders").upsert({
      id: folder.id,
      user_id: ctx.user.id,
      name: clean,
      created_at: now,
      updated_at: now,
    });
    if (!error) folder.storage = "cloud";
  }
  return folder;
}

export async function deleteMultimediaProjectFolder(id: string) {
  if (isBrowser()) {
    const database = await openDatabase();
    try {
      const tx = database.transaction([FOLDER_STORE, STORE_NAME], "readwrite");
      tx.objectStore(FOLDER_STORE).delete(id);
      const projects = await requestResult(tx.objectStore(STORE_NAME).getAll()) as SavedProjectRecord[];
      for (const project of projects) if (project.folderId === id) tx.objectStore(STORE_NAME).put({ ...project, folderId: null, updatedAt: new Date().toISOString() });
      await transactionDone(tx);
    } finally { database.close(); }
  }

  const ctx = await cloudContext();
  if (ctx) {
    await ctx.supabase.from("multimedia_projects").update({ folder_id: null, updated_at: new Date().toISOString() }).eq("user_id", ctx.user.id).eq("folder_id", id);
    await ctx.supabase.from("multimedia_project_folders").delete().eq("user_id", ctx.user.id).eq("id", id);
  }
}

export async function saveMultimediaProject(project: MultimediaProject, assets: PersistableStudioAsset[], existingId?: string | null, folderId?: string | null): Promise<SavedProjectSummary> {
  const active = getActiveProjectPointer();
  const id = existingId || (active?.projectId === project.id ? active.savedId : null) || `saved-${crypto.randomUUID()}`;
  const persistedAssets = assetsForPersistence(project, assets);
  const localSummary = await saveLocalProject(project, persistedAssets, id, folderId);
  setActiveProjectPointer(id, project.id);

  const ctx = await cloudContext();
  if (!ctx) return localSummary;

  try {
    const { data: previousRow } = await ctx.supabase
      .from("multimedia_projects")
      .select("assets,created_at,folder_id")
      .eq("user_id", ctx.user.id)
      .eq("id", id)
      .maybeSingle();
    const previousAssets = new Map<string, PersistableStudioAsset>(
      (Array.isArray(previousRow?.assets) ? previousRow.assets : []).map((asset: PersistableStudioAsset) => [asset.id, asset]),
    );

    const cloudAssets: PersistableStudioAsset[] = [];
    for (const asset of persistedAssets) {
      const previous = previousAssets.get(asset.id);
      let cloudPath = asset.cloudPath || previous?.cloudPath;

      if (asset.local && asset.url && !cloudPath) {
        const response = await fetch(asset.url);
        if (!response.ok) throw new Error(`No se pudo leer ${asset.name} para guardarlo en la nube.`);
        const blob = await response.blob();
        cloudPath = `${ctx.user.id}/${id}/${asset.id}-${safeStorageName(asset.name)}`;
        const { error: uploadError } = await ctx.supabase.storage.from(CLOUD_BUCKET).upload(cloudPath, blob, {
          upsert: true,
          contentType: asset.mime || blob.type || undefined,
          cacheControl: "3600",
        });
        if (uploadError) throw uploadError;
      }

      cloudAssets.push({
        ...asset,
        url: asset.local || cloudPath ? "" : asset.url,
        cloudPath,
        local: cloudPath ? true : asset.local,
        missing: false,
      });
    }

    const now = new Date().toISOString();
    const { error } = await ctx.supabase.from("multimedia_projects").upsert({
      id,
      user_id: ctx.user.id,
      title: project.title || "Proyecto multimedia",
      project: { ...project, updatedAt: now },
      assets: cloudAssets,
      folder_id: folderId === undefined ? previousRow?.folder_id || null : folderId,
      created_at: previousRow?.created_at || now,
      updated_at: now,
    }, { onConflict: "id" });
    if (error) throw error;

    return {
      id,
      title: project.title || "Proyecto multimedia",
      createdAt: previousRow?.created_at || now,
      updatedAt: now,
      folderId: folderId === undefined ? previousRow?.folder_id || null : folderId,
      assetCount: cloudAssets.length,
      storage: "cloud",
    };
  } catch (error) {
    console.warn("[multimedia] El guardado en nube falló; se conservó la copia local.", error);
    return localSummary;
  }
}

export async function moveMultimediaProjectToFolder(id: string, folderId: string | null) {
  if (isBrowser()) {
    const database = await openDatabase();
    try {
      const read = database.transaction(STORE_NAME, "readonly");
      const record = await requestResult(read.objectStore(STORE_NAME).get(id)) as SavedProjectRecord | undefined;
      if (record) {
        const tx = database.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put({ ...record, folderId, updatedAt: new Date().toISOString() });
        await transactionDone(tx);
      }
    } finally { database.close(); }
  }
  const ctx = await cloudContext();
  if (ctx) {
    const { error } = await ctx.supabase.from("multimedia_projects").update({ folder_id: folderId, updated_at: new Date().toISOString() }).eq("user_id", ctx.user.id).eq("id", id);
    if (error) throw error;
  }
}

export async function loadMultimediaProject(id: string): Promise<RestoredProject> {
  const ctx = await cloudContext();
  if (ctx) {
    const { data, error } = await ctx.supabase
      .from("multimedia_projects")
      .select("id,title,created_at,updated_at,folder_id,project,assets")
      .eq("user_id", ctx.user.id)
      .eq("id", id)
      .maybeSingle();
    if (!error && data) {
      const row = data as CloudProjectRow;
      const assets: PersistableStudioAsset[] = [];
      for (const rawAsset of Array.isArray(row.assets) ? row.assets : []) {
        if (rawAsset.cloudPath) {
          const { data: signed, error: signedError } = await ctx.supabase.storage.from(CLOUD_BUCKET).createSignedUrl(rawAsset.cloudPath, 60 * 60 * 6);
          assets.push({ ...rawAsset, url: signedError ? "" : signed?.signedUrl || "", local: false, missing: Boolean(signedError || !signed?.signedUrl) });
        } else {
          assets.push({ ...rawAsset, local: false, missing: !rawAsset.url && Boolean(rawAsset.missing) });
        }
      }
      setActiveProjectPointer(row.id, row.project.id);
      return { id: row.id, folderId: row.folder_id || null, project: structuredClone(row.project), assets, storage: "cloud" };
    }
  }
  return loadLocalProject(id);
}

export async function deleteMultimediaProject(id: string) {
  await deleteLocalProject(id);
  const ctx = await cloudContext();
  if (ctx) {
    await deleteCloudFilesForProject(ctx.supabase, ctx.user.id, id);
    const { error } = await ctx.supabase.from("multimedia_projects").delete().eq("user_id", ctx.user.id).eq("id", id);
    if (error) throw error;
  }
  clearActiveProjectPointer(id);
}

export async function clearMultimediaProjects() {
  await clearLocalProjects();
  const ctx = await cloudContext();
  if (ctx) {
    const { data } = await ctx.supabase.from("multimedia_projects").select("id").eq("user_id", ctx.user.id);
    for (const item of data || []) await deleteCloudFilesForProject(ctx.supabase, ctx.user.id, item.id);
    const { error } = await ctx.supabase.from("multimedia_projects").delete().eq("user_id", ctx.user.id);
    if (error) throw error;
  }
  clearActiveProjectPointer();
}
