import "./apply-multimedia-project-library.mjs";
import fs from "node:fs";

const client = fs.readFileSync("components/multimedia/MultimediaStudioV3Client.tsx", "utf8");
const store = fs.readFileSync("lib/multimedia/project-store.ts", "utf8");
const library = fs.readFileSync("components/multimedia/MultimediaProjectLibraryClient.tsx", "utf8");
const migration = fs.readFileSync("supabase/migrations/202609010001_multimedia_project_cloud_library.sql", "utf8");
function need(source, text, label) { if (!source.includes(text)) throw new Error(`[multimedia-folders] Falta ${label}`); }

need(store, 'const DB_VERSION = 2', 'IndexedDB v2');
need(store, 'const FOLDER_STORE = "folders"', 'store de carpetas');
need(store, 'createMultimediaProjectFolder', 'crear carpetas');
need(store, 'moveMultimediaProjectToFolder', 'mover proyectos');
need(store, 'previous?.blob', 'cache de archivos para autoguardado');
need(store, 'from("multimedia_projects")', 'sincronización de proyectos en Supabase');
need(store, 'CLOUD_BUCKET = "multimedia-projects"', 'bucket multimedia');
need(client, 'const [savedFolders', 'estado de carpetas');
need(client, 'const [autoSaveEnabled', 'autoguardado');
need(client, 'Carpeta del proyecto', 'selector de carpeta');
need(client, 'Borrar todos', 'borrado masivo');
need(client, 'MP3 · solo audio', 'MP3 en selector superior');
need(client, 'WAV · solo audio', 'WAV en selector superior');
need(client, 'removeAsset(asset)', 'eliminación de archivos del panel');
need(client, '/multimedia-studio/projects', 'enlace a biblioteca');
need(client, 'URLSearchParams(window.location.search)', 'apertura de proyecto por URL');
need(library, 'Mis proyectos multimedia', 'página de biblioteca');
need(library, 'duplicateProject', 'duplicación de proyectos');
need(migration, 'create table if not exists public.multimedia_projects', 'tabla cloud');
need(migration, "'multimedia-projects'", 'storage cloud');
console.log('[multimedia-folders] OK · carpetas, MP3/WAV, borrado, biblioteca, nube y autoguardado');
