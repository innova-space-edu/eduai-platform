import assert from "node:assert/strict"
import { getQrLinkPreview, validateCollectionLinks } from "../lib/qr/collection"

const example = { id: "item-a", title: "Música", description: "", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1s" }
const sample = validateCollectionLinks([example, { ...example, id: "item-b", title: "Archivo", url: "https://drive.google.com/file/d/test/view" }])
assert.equal(sample.error, null)
assert.equal(sample.links.length, 2)
assert.equal(sample.links[0].url, example.url, "No debe alterar los enlaces largos ni sus parámetros")
assert.equal(getQrLinkPreview(example.url).thumbnail, "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg")
assert.equal(getQrLinkPreview("https://youtu.be/dQw4w9WgXcQ").videoId, "dQw4w9WgXcQ")
assert.equal(getQrLinkPreview("https://music.youtube.com/watch?v=dQw4w9WgXcQ").thumbnail, "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg")
assert.equal(getQrLinkPreview("https://www.youtube.com/shorts/dQw4w9WgXcQ").videoId, "dQw4w9WgXcQ")
assert.equal(getQrLinkPreview("https://open.spotify.com/track/abc").kind, "spotify")
assert.equal(getQrLinkPreview("https://drive.google.com/file/d/abc/view").kind, "drive")
assert.ok(validateCollectionLinks([]).error)
assert.ok(validateCollectionLinks(Array.from({ length: 26 }, (_, index) => ({ ...example, id: "item-" + index }))).error)
assert.ok(validateCollectionLinks([{ ...example, url: "javascript:alert(1)" }]).error)
assert.ok(validateCollectionLinks([{ ...example, url: "https://user:pass@site.test/a" }]).error)
assert.ok(validateCollectionLinks([{ ...example, title: "" }]).error)
assert.equal(validateCollectionLinks([{ ...example, url: "https://example.com/" + "x".repeat(5000) }]).links.length, 0)
console.log("QR Studio collection validation: OK")
