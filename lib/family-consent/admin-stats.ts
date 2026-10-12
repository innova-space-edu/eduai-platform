/** Aggregated, admin-only family consent statistics. An invitation is never a No. */
export type FamilyDecisionRow = {
  status: string
  submitted_at: string | null
  decisions: Record<string, unknown> | null
}
export type ConsentPurpose = { key: string; title: string }
export function summarizeFamilyResponses(rows: FamilyDecisionRow[], purposes: readonly ConsentPurpose[]) {
  const totals = { invitations: rows.length, answered: 0, accessYes: 0, accessNo: 0,
    pendingReview: 0, approved: 0, rejected: 0, revoked: 0, awaitingResponse: 0 }
  const byPurpose = purposes.map(p => ({ key: p.key, title: p.title, yes: 0, no: 0 }))
  for (const row of rows) {
    if (row.status === "submitted") totals.pendingReview++
    if (row.status === "approved") totals.approved++
    if (row.status === "rejected") totals.rejected++
    if (row.status === "revoked") totals.revoked++
    if (row.status === "invited") totals.awaitingResponse++
    // Submitted responses persist even after institutional rejection or revocation.
    if (!row.submitted_at || !row.decisions || typeof row.decisions !== "object") continue
    totals.answered++
    for (const p of byPurpose) {
      const choice = row.decisions[p.key]
      if (choice === true) p.yes++
      else if (choice === false) p.no++
    }
    if (row.decisions.platform_access === true) totals.accessYes++
    else if (row.decisions.platform_access === false) totals.accessNo++
  }
  return { totals, byPurpose }
}
