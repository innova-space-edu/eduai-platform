/**
 * Convert legacy model math delimiters to the Markdown math syntax supported
 * by remark-math, without touching fenced or inline code.
 */
export function prepareRichChatContent(raw: string): string {
  const input = String(raw || "").replace(/\r\n?/g, "\n");
  return input
    .split(/(```[\s\S]*?```|`[^`\n]+`)/g)
    .map((part, index) => {
      if (index % 2 === 1) return part;
      return part
        .replace(/\\\[([\s\S]*?)\\\]/g, (_match, value: string) => "\n\n$$\n" + value.trim() + "\n$$\n\n")
        .replace(/\\\(([\s\S]*?)\\\)/g, (_match, value: string) => "$" + value.trim() + "$")
        .replace(/^[ \t]*\[[ \t]*([^\n\]]*\\(?:frac|sqrt|Delta|quad|neq|pm|sum|int|alpha|beta|gamma)[^\n\]]*)[ \t]*\][ \t]*$/gm,
          (_match, value: string) => "\n\n$$\n" + value.trim() + "\n$$\n\n");
    })
    .join("");
}
