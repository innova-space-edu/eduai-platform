import { unzipSync } from "fflate"

const MAX_SIZE = 8 * 1024 * 1024

/** Unpack a single WAV on the user's device. Never send the original ZIP to the server. */
export async function prepareKaggleVoiceUpload(input: File): Promise<File> {
  if (input.name.toLowerCase().endsWith(".wav")) {
    if (input.size < 44 || input.size > MAX_SIZE) throw new Error("El WAV debe pesar entre 44 bytes y 8 MB.")
    return input
  }
  if (!input.name.toLowerCase().endsWith(".zip")) {
    throw new Error("Selecciona un archivo WAV o un ZIP exportado desde Kaggle.")
  }
  if (input.size < 25 || input.size > MAX_SIZE) throw new Error("El ZIP supera 8 MB o está vacío.")

  const bytes = new Uint8Array(await input.arrayBuffer())
  let wavEntryCount = 0
  let archive: Record<string, Uint8Array>
  try {
    archive = unzipSync(bytes, {
      filter: (item) => {
        if (!/\.wav$/i.test(item.name)) return false
        // Explicitly reject archives with paths, multiple recordings or inflated entries.
        if (item.name.includes("/") || item.name.includes("\\") || item.name.startsWith(".")) {
          throw new Error("El ZIP debe contener un WAV directamente en la carpeta raíz.")
        }
        if (item.originalSize < 44 || item.originalSize > MAX_SIZE) {
          throw new Error("El WAV contenido en el ZIP supera el límite de 8 MB.")
        }
        wavEntryCount += 1
        if (wavEntryCount > 1) throw new Error("El ZIP debe contener un único archivo WAV.")
        return true
      },
    })
  } catch (reason) {
    if (reason instanceof Error && /ZIP debe|WAV contenido/.test(reason.message)) throw reason
    throw new Error("No se pudo abrir el ZIP. Exporta un ZIP que contenga un solo archivo WAV.")
  }
  const entries = Object.entries(archive)
  if (entries.length !== 1 || !/\.wav$/i.test(entries[0][0])) {
    throw new Error("El ZIP no contiene un único archivo WAV.")
  }
  const [name, data] = entries[0]
  if (data.byteLength < 44 || data.byteLength > MAX_SIZE) {
    throw new Error("El WAV extraído es demasiado grande.")
  }
  return new File([new Uint8Array(data)], name, { type: "audio/wav" })
}
