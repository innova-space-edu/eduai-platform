import assert from "node:assert/strict"
import { NextRequest } from "next/server"
import { proxy } from "../proxy"
import { isPublicRepositoryRead } from "../lib/repository/public-read"

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

  console.log("Public repository reads skip session gates; administration and writes stay in normal flow.")
}
void main()
