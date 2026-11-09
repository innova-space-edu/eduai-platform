import assert from "node:assert/strict"
import { NextRequest } from "next/server"
import { proxy } from "../proxy"
import { isPublicRepositoryRead, isPublicRepositorySubmission } from "../lib/repository/public-read"

const publicPaths = [
  "/nube-publica/example",
  "/nube/example",
  "/api/repository/public/example",
  "/api/repository/public-access/example/items",
  "/api/repository/public-access/example/items/item",
]
async function main() {
  for (const pathname of publicPaths) {
    for (const method of ["GET", "HEAD"]) {
      // Even with an EduAI cookie, these requests must proceed before any session or consent lookup.
      const request = new NextRequest(`https://eduai.example${pathname}?download=1`, {
        method, headers: { cookie: "sb-example-auth-token=stale-session" },
      })
      const response = await proxy(request)
      assert.equal(response.headers.get("x-middleware-next"), "1")
    }
    for (const method of ["POST", "PUT", "DELETE"]) assert.equal(isPublicRepositoryRead(pathname, method), false)
  }

  for (const pathname of [
    "/repositorio",
    "/api/repository/public-access/admin-link",
    "/api/repository/public-access/admin-link/items",
    "/api/repository/items",
    "/nube-publica",
    "/nube-publica/example/admin",
    "/api/repository/public-access/example/items/item/edit",
  ]) assert.equal(isPublicRepositoryRead(pathname, "GET"), false)

  const guestUpload = "/api/repository/public-access/example/items"
  for (const method of ["POST", "PUT"]) {
    assert.equal(isPublicRepositorySubmission(guestUpload, method), true)
    assert.equal(isPublicRepositorySubmission(`${guestUpload}/item`, method), false)
    assert.equal(isPublicRepositorySubmission("/api/repository/moderation", method), false)
  }
  assert.equal(isPublicRepositorySubmission(guestUpload, "DELETE"), false)
  console.log("Public reads and moderated guest submissions skip the session gate; admin routes remain protected.")
}
void main()
