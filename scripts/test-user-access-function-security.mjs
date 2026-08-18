import fs from "node:fs"
import path from "node:path"

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260818053511_user_access_function_security.sql",
)

if (!fs.existsSync(migrationPath)) {
  throw new Error("[test-user-access-security] Falta migración correctiva 20260818053511")
}

const sql = fs.readFileSync(migrationPath, "utf8")
const executableSql = sql.replace(/--.*$/gm, "")

function requireText(value, label) {
  if (!sql.includes(value)) {
    throw new Error(`[test-user-access-security] Falta ${label}: ${value}`)
  }
}

requireText("create or replace function public.handle_new_eduai_user_access()", "trigger de alta")
requireText("security definer\nset search_path = ''", "SECURITY DEFINER con search_path vacío")
requireText(
  "revoke execute on function public.handle_new_eduai_user_access() from public, anon, authenticated;",
  "revocación de RPC público/autenticado",
)
requireText(
  "grant execute on function public.handle_new_eduai_user_access() to supabase_auth_admin;",
  "ejecución reservada para Supabase Auth",
)
requireText(
  "create or replace function public.guard_eduai_user_access_sensitive_update()",
  "guard de campos sensibles",
)
requireText("security invoker\nset search_path = ''", "guard SECURITY INVOKER")
requireText("if (select auth.uid()) = old.user_id then", "guard basado en auth.uid()")
requireText(
  "grant execute on function public.guard_eduai_user_access_sensitive_update() to authenticated, service_role;",
  "roles legítimos del trigger de actualización",
)

if (/auth\.role\s*\(/i.test(executableSql)) {
  throw new Error("[test-user-access-security] La migración correctiva no debe ejecutar auth.role()")
}

console.log("[test-user-access-security] funciones de acceso sin RPC privilegiado y sin auth.role() ejecutable verificadas")
