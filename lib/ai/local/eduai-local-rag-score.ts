export type EduAIRagRecord = {
  source: string;
  content: string;
};

export type EduAIRagRankedHit = {
  source: string;
  snippet: string;
  score: number;
};

const STOP_WORDS = new Set([
  "como", "donde", "para", "esta", "este", "esto", "desde", "sobre", "entre",
  "cual", "cuando", "porque", "que", "del", "los", "las", "una", "uno", "con",
  "por", "the", "and", "from", "what", "where", "which", "this", "that",
]);

export function normalizeEduAIRagText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function eduAIRagQueryTerms(query: string) {
  return [...new Set(
    normalizeEduAIRagText(query)
      .split(/[^a-z0-9_.$/-]+/)
      .map((term) => term.trim())
      .filter((term) => term.length >= 3 && !STOP_WORDS.has(term)),
  )].slice(0, 16);
}

export function scoreEduAIRagRecord(
  record: EduAIRagRecord,
  query: string,
  terms = eduAIRagQueryTerms(query),
): EduAIRagRankedHit | null {
  const source = normalizeEduAIRagText(record.source);
  const content = normalizeEduAIRagText(record.content);
  const normalizedQuery = normalizeEduAIRagText(query).trim();
  const symbolRecord = source.startsWith("__eduai__/symbols/");
  const architectureRecord = source.startsWith("__eduai__/development-map/");
  let score = 0;
  let matchedTerms = 0;

  if (normalizedQuery.length >= 4 && content.includes(normalizedQuery)) score += 24;
  if (normalizedQuery.length >= 4 && source.includes(normalizedQuery)) score += 30;

  for (const term of terms) {
    let matched = false;
    if (source.includes(term)) {
      score += term.includes("/") || term.includes(".") ? 14 : 8;
      matched = true;
    }

    const first = content.indexOf(term);
    if (first >= 0) {
      score += 3;
      matched = true;
      const second = content.indexOf(term, first + term.length);
      if (second >= 0) score += 1;
    }

    if (symbolRecord && new RegExp(`(?:function|class|type|interface|const|enum|re-export|sql-[a-z-]+):\\s*${term.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&")}\\b`, "i").test(record.content)) {
      score += 18;
      matched = true;
    }

    if (matched) matchedTerms += 1;
  }

  if (terms.length > 1 && matchedTerms === terms.length) score += 8;
  if (symbolRecord && matchedTerms > 0) score += 5;
  if (architectureRecord && matchedTerms > 0) score += 2;

  if (score <= 0) return null;
  return {
    source: record.source,
    snippet: snippetFor(record, content, terms),
    score,
  };
}

function snippetFor(record: EduAIRagRecord, normalizedContent: string, terms: string[]) {
  const firstTerm = terms.find((term) => normalizedContent.includes(term));
  const position = firstTerm ? normalizedContent.indexOf(firstTerm) : 0;
  const start = Math.max(0, position - 280);
  return record.content.slice(start, start + 1600);
}

export function rankEduAIRagRecords(
  records: EduAIRagRecord[],
  query: string,
  limit = 4,
): EduAIRagRankedHit[] {
  const terms = eduAIRagQueryTerms(query);
  if (!terms.length) return [];

  const scored: EduAIRagRankedHit[] = [];
  for (const record of records) {
    const hit = scoreEduAIRagRecord(record, query, terms);
    if (hit) scored.push(hit);
  }

  return scored
    .sort((a, b) => b.score - a.score || a.source.localeCompare(b.source))
    .slice(0, Math.max(1, Math.min(8, limit)));
}
