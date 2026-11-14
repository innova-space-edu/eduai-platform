/** Parse strict JSON first; recover unescaped LaTeX only from otherwise malformed JSON. @param {string} text */
export function parseExamModelJson(text) {
  const cleaned = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const first = cleaned.indexOf("{"), last = cleaned.lastIndexOf("}");
  const candidate = first >= 0 && last > first ? cleaned.slice(first,last+1) : cleaned;
  try { return JSON.parse(candidate); } catch {}
  let repaired = "", inString = false;
  for (let i=0; i<candidate.length; i++) {
    const ch=candidate[i];
    if (ch === '"' ) { inString=!inString; repaired+=ch; continue; }
    if (!inString || ch !== "\\") { repaired+=ch; continue; }
    const next=candidate[i+1];
    if (next === undefined) { repaired+=ch; continue; }
    if (next === "\\" || next === '"' || next === "/") { repaired+=ch+next; i++; continue; }
    const command=candidate.slice(i+1).match(/^[A-Za-z]+/)?.[0] || "";
    const latex = /^(frac|dfrac|tfrac|text|textbf|textit|times|tan|theta|tau|begin|beta|bar|binom|boldsymbol|right|rho|rightarrow|neq|nabla|nu|not|sqrt|sin|cos|cdot|left|log|ln|pi|alpha|gamma|delta|sum|int|infty|leq|geq|pm|overline|underline|underbrace|vec|quad|qquad|mathrm|mathbf|mathbb|leftarrow|approx|div|circ|partial|mu|sigma|lambda|phi|omega|epsilon|varepsilon)$/i.test(command);
    if (latex || (!"bfnrtu".includes(next)) || (next==="u" && !/^[0-9a-fA-F]{4}/.test(candidate.slice(i+2,i+6)))) { repaired+="\\\\"+next; i++; continue; }
    repaired+=ch+next; i++;
  }
  try { return JSON.parse(repaired); } catch { throw new Error("La IA devolvió un formato de evaluación inválido. Vuelve a analizar el archivo."); }
}
