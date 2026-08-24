// Fachada de compatibilidad para Notebook. La política SSRF vive únicamente
// en lib/safe-remote-url.ts para que Creator, Notebook, Assets y Video usen
// exactamente la misma validación de DNS/IP y redirecciones.
import { assertSafeRemoteUrl, safeRemoteFetch } from "@/lib/safe-remote-url"

export async function assertPublicHttpUrl(input: string): Promise<URL> {
  return assertSafeRemoteUrl(input)
}

export async function fetchPublicUrl(
  input: string | URL,
  init: RequestInit = {},
  maxRedirects = 5,
): Promise<Response> {
  return safeRemoteFetch(input, init, maxRedirects)
}
