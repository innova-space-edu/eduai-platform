import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import ts from "typescript"

const [transitionPath, proxyPath, pendingPath] = process.argv.slice(2)
assert.ok(transitionPath && proxyPath && pendingPath, "Faltan rutas de prueba")
const src = readFileSync(transitionPath, "utf8")
const compiled = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
const ctx = { exports: {}, Date, Number }
runInNewContext(compiled, ctx, { timeout: 3000 })
const check = ctx.exports.shouldEnforceFamilyConsent
assert.equal(typeof check, "function", "Debe existir verificación independiente del flag global")

const early = "2026-10-01T12:00:00.000Z"
const previousSnapshot = "2026-10-11T01:00:00.000Z"
const latest = "2026-10-11T17:00:00.000Z"
const october = Date.parse("2026-10-20T12:00:00.000Z")
const november = Date.parse("2026-11-15T03:00:01.000Z")
assert.equal(check(early, previousSnapshot, false, october), false, "Cuenta antigua: no se bloquea antes del plazo")
assert.equal(check(early, previousSnapshot, true, october), false, "Cuenta antigua: bandera activada no termina la transición")
assert.equal(check(latest, latest, false, october), true, "Alta nueva: exige autorización incluso antes del corte horario")
assert.equal(check(latest, "2026-10-11T17:00:30.000Z", false, october), true, "Alta nueva: tolerancia por transacción")
assert.equal(check(latest, "2026-10-11T17:01:02.000Z", false, october), false, "No confiar en capturas tardías")
assert.equal(check("2026-10-12T04:00:00.000Z", null, false, october), true, "Alta posterior al corte: bloqueo inmediato")
assert.equal(check(early, previousSnapshot, true, november), true, "Cuenta antigua: aplicar después del plazo si se habilitó")
assert.equal(check(early, previousSnapshot, false, november), false, "No activar bandera sin intervención")
assert.equal(check(null, null, false, october), true, "Antigüedad no comprobable: no abrir acceso")

const proxy = readFileSync(proxyPath, "utf8")
const pending = readFileSync(pendingPath, "utf8")
assert.match(proxy, /family_authorization_requests/, "Solo permitir autorizaciones institucionales registradas")
assert.match(proxy, /platform_access/, "El permiso de acceso debe constar expresamente")
assert.match(proxy, /403/, "Las API deben bloquearse desde el servidor")
assert.match(proxy, /shouldEnforceFamilyConsent\(/, "El proxy debe comprobar cuentas nuevas")
assert.match(proxy, /captured_at/, "La edad debe provenir de la instantánea protegida")
assert.match(pending, /void verifyOrSend\(\)/, "La pantalla pendiente debe solicitar la invitación")
assert.match(pending, /automaticRequestStarted/, "Evitar disparos repetidos por renderizado")
console.log("OK: menores nuevos bloqueados, transición preservada y envío automático preparado")
