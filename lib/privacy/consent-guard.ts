/**
 * Minimal server-side privacy-purpose mapping for EDUAI agent and creator routes.
 * This registry is intentionally conservative and NOT a complete gateway inventory.
 * Before enabling in production, audit remaining endpoints, providers and telemetry.
 */
export type RequiredPrivacyPermission = "ai_generation" | "ai_documents" | "ai_voice"

export function requiredPrivacyPermissionsForRoute(pathname: string, method: string): RequiredPrivacyPermission[] {
  if (method.toUpperCase() !== "POST") return []

  // Independent permissions for cloning or identity-sensitive activities are NOT granted here.
  if (pathname === "/api/agents/audio/voices/terms") return []

  if (pathname === "/api/process-content") return ["ai_generation", "ai_documents"]

  if (pathname.startsWith("/api/agents/")) {
    if (/\/(?:transcription|tts|tts-chunk|speech|voice)(?:\/|$)/.test(pathname)) return ["ai_voice"]
    if (/\/audio\//.test(pathname) && !pathname.endsWith("/terms")) return ["ai_voice"]
    if (/\/(?:paper|exam-import|pdf|document)(?:\/|$)/.test(pathname)) return ["ai_generation", "ai_documents"]
    return ["ai_generation"]
  }

  if (pathname === "/api/superagent/chat") return ["ai_generation"]

  if (
    pathname === "/api/creator/video-summary" ||
    pathname === "/api/creator/comics/image" ||
    pathname === "/api/creator/quality-review"
  ) return ["ai_generation"]

  if (pathname === "/api/whiteboard/solve" || pathname === "/api/whiteboard/recognize") {
    return ["ai_generation"]
  }

  // Other endpoints must be individually inventoried before consent enforcement can be certified.
  return []
}
