// Public repository handlers still validate the link and the material's visibility.
// Only the narrowly scoped guest submission route can also operate without a session.
export function isPublicRepositoryRead(pathname: string, method: string) {
  if (method !== "GET" && method !== "HEAD") return false
  return /^\/(?:nube-publica|nube)\/[^/]+\/?$/.test(pathname)
    || /^\/api\/repository\/public\/[^/]+\/?$/.test(pathname)
    || /^\/api\/repository\/public-access\/(?!admin-link\/)[^/]+\/items(?:\/[^/]+)?\/?$/.test(pathname)
}

export function isPublicRepositorySubmission(pathname: string, method: string) {
  return (method === "POST" || method === "PUT") &&
    /^\/api\/repository\/public-access\/(?!admin-link\/)[^/]+\/items\/?$/.test(pathname)
}
