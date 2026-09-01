import fs from "node:fs";
const client = fs.readFileSync("components/multimedia/MultimediaStudioV3Client.tsx", "utf8");
const store = fs.readFileSync("lib/multimedia/project-store.ts", "utf8");
function need(source, text, label) { if (!source.includes(text)) throw new Error(`[multimedia-folders] Falta ${label}`); }
need(store, 'const DB_VERSION = 2', 'IndexedDB v2');
need(store, 'const FOLDER_STORE = "folders"', 'store de carpetas');
need(store, 'createMultimediaProjectFolder', 'crear carpetas');
need(store, 'moveMultimediaProjectToFolder', 'mover proyectos');
need(store, 'previous?.blob', 'cache de archivos para autoguardado');
need(client, 'const [savedFolders', 'estado de carpetas');
need(client, 'const [autoSaveEnabled', 'autoguardado');
need(client, 'Carpeta del proyecto', 'selector de carpeta');
need(client, 'Borrar todos', 'borrado masivo');
console.log('[multimedia-folders] OK · carpetas, borrado y autoguardado');
