import assert from "node:assert/strict";
import fs from "node:fs";

const component = fs.readFileSync("components/multimedia/MultimediaStudioV3Client.tsx", "utf8");
const projectStore = fs.readFileSync("lib/multimedia/project-store.ts", "utf8");
const converter = fs.readFileSync("lib/multimedia/media-convert.ts", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

assert.match(projectStore, /indexedDB\.open\(DB_NAME, DB_VERSION\)/, "Debe persistir proyectos con IndexedDB");
assert.match(projectStore, /export async function saveMultimediaProject/, "Debe poder guardar proyectos dentro de EDUAI");
assert.match(projectStore, /export async function loadMultimediaProject/, "Debe poder reabrir proyectos guardados");
assert.match(projectStore, /URL\.createObjectURL\(blob\)/, "Debe restaurar archivos locales guardados como Blob");

assert.match(converter, /Mp3OutputFormat/, "Debe incluir salida MP3");
assert.match(converter, /registerMp3Encoder/, "Debe registrar el encoder MP3 bajo demanda");
assert.match(converter, /WavOutputFormat/, "Debe extraer audio de video a WAV editable");
assert.match(converter, /video:\s*\{\s*discard:\s*true\s*\}/, "La extracción debe descartar la pista de video");

assert.match(component, /Guardar en EDUAI/, "La interfaz debe permitir guardar el proyecto en la página");
assert.match(component, /Mis proyectos/, "La interfaz debe listar los proyectos guardados");
assert.match(component, /exportMp3/, "La interfaz debe permitir exportar MP3");
assert.match(component, /Separar audio/, "La interfaz debe permitir separar el audio de un video");
assert.match(component, /muted:\s*true/, "Al separar audio el video debe quedar silenciado para evitar duplicación");
assert.match(component, /resolveAudioTrack\(current, "audio"/, "El audio separado debe colocarse en una pista de audio independiente");

assert.equal(pkg.dependencies?.mediabunny, "1.55.5", "Mediabunny debe quedar fijado a la versión validada");
assert.equal(pkg.dependencies?.["@mediabunny/mp3-encoder"], "1.55.5", "El encoder MP3 debe quedar fijado a la versión validada");

console.log("Multimedia projects/MP3/audio extraction: OK");
