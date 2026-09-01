import assert from "node:assert/strict";
import fs from "node:fs";

const component = fs.readFileSync("components/multimedia/MultimediaStudioV3Client.tsx", "utf8");

assert.match(component, /function CompactAudioEqualizer/, "Debe incluir el ecualizador compacto para proyectos de audio");
assert.match(component, /hasVisualTimelineContent/, "Debe detectar contenido visual en la timeline");
assert.match(component, /hasAudioTimelineContent/, "Debe detectar contenido de audio en la timeline");
assert.match(component, /isAudioOnlyMode\s*=\s*hasAudioTimelineContent\s*&&\s*!hasVisualTimelineContent/, "El modo solo audio debe activarse únicamente cuando no hay contenido visual");
assert.match(component, /Monitor de audio/, "El monitor debe identificar visualmente el modo solo audio");
assert.match(component, /CompactAudioEqualizer playing=\{playing\}/, "El modo solo audio debe renderizar el ecualizador");
assert.match(component, /width:\s*"min\(100%, 520px\)"/, "El monitor de audio debe contraerse a un ancho compacto");
assert.match(component, /height:\s*210/, "El monitor de audio debe usar una altura compacta");
assert.match(component, /eduaiAudioEq/, "El ecualizador debe incluir animación moderna de barras");
assert.match(component, /isAudioOnlyMode\s*\?\s*\(/, "La vista previa debe alternar automáticamente entre audio y video");
assert.match(component, /MP3 · solo audio/, "El selector superior debe mantener exportación MP3");
assert.match(component, /Eliminar archivo del proyecto/, "El panel debe mantener la eliminación de recursos");
assert.match(component, /Abrir biblioteca de proyectos/, "Debe mantener acceso a la biblioteca multimedia");

console.log("[multimedia-audio-monitor] OK · monitor compacto, ecualizador y retorno automático a video");
