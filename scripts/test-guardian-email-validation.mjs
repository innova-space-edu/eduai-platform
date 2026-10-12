import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"

const clientPath = process.argv[2]
const serverPath = process.argv[3]
if (!clientPath || !serverPath) {
  throw new Error("Uso: node scripts/test-guardian-email-validation.mjs <formulario> <servidor>")
}
const clientSource = readFileSync(clientPath, "utf8")
const serverSource = readFileSync(serverPath, "utf8")
const clientMatch = clientSource.match(/!\s*(\/\^[^\r\n]+?\/)\.test\(guardianEmail\.trim\(\)\)/)
const serverMatch = serverSource.match(/return\s+(\/\^[^\r\n]+?\/)\.test\(email\)/)
assert.ok(clientMatch, "Debe existir la validación real del correo del apoderado en el formulario")
assert.ok(serverMatch, "Debe existir la validación de correo en el servidor")
const clientPattern = runInNewContext(clientMatch[1])
const serverPattern = runInNewContext(serverMatch[1])
assert.equal(clientPattern.source, serverPattern.source, "Formulario y servidor deben validar el mismo patrón de correo")

for (const address of ["tutor@example.com", "persona.apoderada@outlook.cl", "test+familia@subdominio.example.org", "usuario_123@gmail.com"]) {
  assert.equal(clientPattern.test(address.trim()), true, "Correo legítimo rechazado: " + address)
}
for (const address of ["sin-arroba", "persona@", "@example.com", "persona@example", "persona @example.com", "persona@example .com", ""]) {
  assert.equal(clientPattern.test(address.trim()), false, "Correo mal formado aceptado: " + address)
}
console.log("OK: el correo del representante se valida igual en el formulario y servidor")
