const SECRET_ASSIGNMENT =
  /(?:api[_-]?key|secret|password|passwd|token|private[_-]?key|service[_-]?account|client[_-]?secret|access[_-]?token|refresh[_-]?token)\s*[:=]\s*(?:"[^"]{4,}"|'[^']{4,}'|[^\s#;,]{6,})/i;

const SECRET_VALUE =
  /(?:sk-[a-z0-9_-]{8,}|AIza[a-z0-9_-]{10,}|ghp_[a-z0-9]{10,}|github_pat_[a-z0-9_]{10,}|Bearer\s+[a-z0-9._~-]{10,})/i;

export function shouldRedactEduAILocalCorpusLine(line) {
  return SECRET_ASSIGNMENT.test(line) || SECRET_VALUE.test(line);
}

export function sanitizeEduAILocalCorpusText(text) {
  return text
    .split(/\r?\n/)
    .map((line) =>
      shouldRedactEduAILocalCorpusLine(line)
        ? "[REDACTED_SECRET_LIKE_LINE]"
        : line,
    )
    .join("\n");
}
