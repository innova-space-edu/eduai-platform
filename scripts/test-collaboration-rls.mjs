import fs from "node:fs"

const legacy = fs.readFileSync("supabase/migrations/20260818181335_remove_legacy_room_message_policies.sql", "utf8")
const recursion = fs.readFileSync("supabase/migrations/20260818181435_fix_room_members_rls_recursion.sql", "utf8")

for (const policy of ['"users insert room messages"', '"users read room messages"']) {
  if (!legacy.includes(`drop policy if exists ${policy}`)) {
    throw new Error(`[collaboration-rls] legacy permissive policy not removed: ${policy}`)
  }
}

for (const marker of [
  "is_current_user_room_participant(p_room_id uuid)",
  "security definer",
  "set search_path = ''",
  "public.study_rooms",
  "public.room_members rm",
  "rm.user_id = (select auth.uid())",
  "revoke execute on function public.is_current_user_room_participant(uuid) from public, anon",
  "to authenticated",
  "using (public.is_current_user_room_participant(room_id))",
]) {
  if (!recursion.toLowerCase().includes(marker.toLowerCase())) {
    throw new Error(`[collaboration-rls] recursion-safe membership marker missing: ${marker}`)
  }
}

const policyBlock = recursion.slice(recursion.lastIndexOf('create policy "Users can view room memberships"'))
if (/from\s+public\.room_members\s+rm/i.test(policyBlock)) {
  throw new Error("[collaboration-rls] SELECT policy must not self-reference room_members directly")
}

console.log("[collaboration-rls] legacy room-message bypass removed and membership SELECT is recursion-safe")
