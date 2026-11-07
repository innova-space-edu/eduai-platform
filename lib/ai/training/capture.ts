import type { SupabaseClient } from "@supabase/supabase-js"
import { prepareTrainingPair, trainingFingerprint, TRAINING_POLICY_VERSION } from "./safety"

export async function captureTrainingCandidate(input: {
  supabase?: SupabaseClient | null; userId?: string | null; module?: string | null;
  messages: Array<{ role: string; content: unknown }>; answer: string; provider?: string; model?: string
}) {
  if (!input.supabase || !input.userId) return
  try {
    // No hidden system instructions, tool results, previous conversations or attachments are collected.
    const lastUser = [...input.messages].reverse().find(m => m.role === "user")
    if (typeof lastUser?.content !== "string") return
    const messages = prepareTrainingPair(lastUser.content, input.answer)
    if (!messages) return
    const { data, error } = await input.supabase.from("ai_training_consents").select("owner_id")
      .eq("owner_id",input.userId).eq("enabled",true).eq("policy_version",TRAINING_POLICY_VERSION).abortSignal(AbortSignal.timeout(1500)).maybeSingle()
    if (error || !data) return
    await input.supabase.from("ai_training_candidates").upsert({ owner_id: input.userId,
      source_module: (input.module || "gateway").slice(0,120), messages, fingerprint: trainingFingerprint(messages),
      origin: "generation", policy_version: TRAINING_POLICY_VERSION,
      provider: input.provider?.slice(0,100), model: input.model?.slice(0,150),
    },{ onConflict: "owner_id,fingerprint", ignoreDuplicates: true }).abortSignal(AbortSignal.timeout(1500))
  } catch { /* Training collection must never break a generation. */ }
}
