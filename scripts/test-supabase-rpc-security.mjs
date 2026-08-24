import fs from "node:fs"

const files = {
  triggers: "supabase/migrations/20260818175832_harden_trigger_function_execute_grants.sql",
  tutor: "supabase/migrations/20260818175959_harden_claim_tutor_lock_authorization.sql",
  rpc: "supabase/migrations/20260818180159_harden_authenticated_rpc_execute_grants.sql",
  definer: "supabase/migrations/20260818180320_harden_security_definer_search_path.sql",
  paths: "supabase/migrations/20260818180507_fix_remaining_function_search_paths.sql",
}

const sql = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file, "utf8")]))

for (const fn of [
  "capture_ai_generation_provider_health",
  "generate_profile_user_code",
  "handle_new_eduai_user_access",
  "handle_new_user",
  "notify_friend_accept",
  "notify_friend_request",
  "notify_new_message",
  "update_user_count",
]) {
  if (!sql.triggers.includes(fn)) throw new Error(`[supabase-rpc-security] trigger-only function missing: ${fn}`)
}
for (const marker of ["from public", "from anon", "from authenticated", "to service_role"]) {
  if (!sql.triggers.toLowerCase().includes(marker)) throw new Error(`[supabase-rpc-security] trigger grant marker missing: ${marker}`)
}

for (const marker of [
  "p_owner <> v_user_id",
  "public.room_members",
  "rm.user_id = v_user_id",
  "least(coalesce(p_seconds, 15), 30)",
  "revoke execute on function public.claim_tutor_lock(uuid, uuid, integer) from anon",
]) {
  if (!sql.tutor.includes(marker)) throw new Error(`[supabase-rpc-security] tutor lock hardening missing: ${marker}`)
}

for (const marker of [
  "p_user_id is distinct from (select auth.uid())",
  "generate_exam_code() from public, anon, authenticated",
  "generate_user_code() from public, anon, authenticated",
  "cleanup_audio_voice_security_sessions() from public, anon, authenticated",
  "accept_voice_cloning_terms(text, date, text) from public, anon",
  "is_model_lab_admin() from public, anon",
]) {
  if (!sql.rpc.includes(marker)) throw new Error(`[supabase-rpc-security] authenticated RPC hardening missing: ${marker}`)
}
if (sql.rpc.includes("record_qr_scan") || sql.rpc.includes("creator_hub_shared_project")) {
  throw new Error("[supabase-rpc-security] intentionally public QR/share-token RPCs must not be revoked here")
}

if (!sql.definer.includes("set search_path = ''") || !sql.definer.includes("public.admin_emails")) {
  throw new Error("[supabase-rpc-security] is_admin search_path/qualification hardening missing")
}
for (const fn of ["notify_friend_accept", "notify_friend_request", "notify_new_message"]) {
  if (!sql.definer.includes(`alter function public.${fn}() set search_path = '';`)) {
    throw new Error(`[supabase-rpc-security] fixed SECURITY DEFINER search_path missing: ${fn}`)
  }
}
for (const marker of [
  "match_notebook_chunks(uuid, extensions.vector, integer, boolean) set search_path = pg_catalog, extensions",
  "match_paper_chunks(extensions.vector, integer, uuid, uuid) set search_path = pg_catalog, extensions",
  "search_notebook_chunks_fts(uuid, text, integer, boolean) set search_path = ''",
]) {
  if (!sql.paths.includes(marker)) throw new Error(`[supabase-rpc-security] function search_path hardening missing: ${marker}`)
}

console.log("[supabase-rpc-security] trigger RPCs, tutor lock, authenticated grants and fixed search_paths verified")
