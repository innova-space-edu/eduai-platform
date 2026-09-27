const JS_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const PY_EXTENSIONS = new Set([".py"]);
const SHELL_EXTENSIONS = new Set([".sh"]);
const SQL_EXTENSIONS = new Set([".sql"]);

function pushSymbol(target, seen, symbol) {
  const key = `${symbol.kind}:${symbol.name}:${symbol.line}`;
  if (seen.has(key)) return;
  seen.add(key);
  target.push(symbol);
}

export function extractEduAILocalSymbols(source, text) {
  const dot = source.lastIndexOf(".");
  const ext = dot >= 0 ? source.slice(dot).toLowerCase() : "";
  const symbols = [];
  const seen = new Set();
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("#") || trimmed.startsWith("--")) continue;
    const line = index + 1;

    if (JS_EXTENSIONS.has(ext)) {
      let match = raw.match(/^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/);
      if (match) {
        pushSymbol(symbols, seen, { name: match[1], kind: "function", line });
        continue;
      }

      match = raw.match(/^\s*(?:export\s+)?(?:default\s+)?class\s+([A-Za-z_$][\w$]*)/);
      if (match) {
        pushSymbol(symbols, seen, { name: match[1], kind: "class", line });
        continue;
      }

      match = raw.match(/^\s*export\s+(?:declare\s+)?(interface|type|enum|const|let|var)\s+([A-Za-z_$][\w$]*)/);
      if (match) {
        pushSymbol(symbols, seen, { name: match[2], kind: match[1], line });
        continue;
      }

      match = raw.match(/^\s*export\s*\{\s*([^}]+)\s*\}/);
      if (match) {
        for (const item of match[1].split(",")) {
          const original = item.trim().split(/\s+as\s+/i)[0]?.trim();
          if (original && /^[A-Za-z_$][\w$]*$/.test(original)) {
            pushSymbol(symbols, seen, { name: original, kind: "re-export", line });
          }
        }
      }
      continue;
    }

    if (PY_EXTENSIONS.has(ext)) {
      let match = raw.match(/^\s*(?:async\s+)?def\s+([A-Za-z_][\w]*)\s*\(/);
      if (match) {
        pushSymbol(symbols, seen, { name: match[1], kind: "function", line });
        continue;
      }
      match = raw.match(/^\s*class\s+([A-Za-z_][\w]*)\b/);
      if (match) pushSymbol(symbols, seen, { name: match[1], kind: "class", line });
      continue;
    }

    if (SHELL_EXTENSIONS.has(ext)) {
      const match = raw.match(/^\s*(?:function\s+)?([A-Za-z_][\w-]*)\s*\(\s*\)\s*\{/);
      if (match) pushSymbol(symbols, seen, { name: match[1], kind: "shell-function", line });
      continue;
    }

    if (SQL_EXTENSIONS.has(ext)) {
      const match = raw.match(/^\s*create\s+(?:or\s+replace\s+)?(table|view|function|procedure|trigger|policy)\s+(?:if\s+not\s+exists\s+)?["`]?([A-Za-z_][\w.]*)/i);
      if (match) pushSymbol(symbols, seen, { name: match[2], kind: `sql-${match[1].toLowerCase()}`, line });
    }
  }

  return symbols.slice(0, 250);
}

export function renderEduAILocalSymbolDocument(source, symbols) {
  if (!symbols.length) return "";
  return [
    `# EDUAI Symbol Index · ${source}`,
    "",
    `Archivo: ${source}`,
    "",
    ...symbols.map((symbol) => `- ${symbol.kind}: ${symbol.name} (L${symbol.line})`),
  ].join("\n");
}
