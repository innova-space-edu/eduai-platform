// Public repository handlers still validate the link and the material's visibility.
// Keep write methods and administrative routes in the normal session flow.
export function isPublicRepositoryRead(pathname: string, method: string) {
  if (method !== "GET" && method !== "HEAD") return false
  return /^\/(?:nube-publica|nube)\/[^/]+\/?$/.test(pathname)
    || /^\/api\/repository\/public\/[^/]+\/?$/.test(pathname)
    || /^\/api\/repository\/public-access\/(?!admin-link\/)[^/]+\/items(?:\/[^/]+)?\/?$/.test(pathname)
}
