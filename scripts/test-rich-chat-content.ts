import assert from "node:assert/strict"
import { prepareRichChatContent } from "../lib/text/prepare-rich-chat-content"

const square = prepareRichChatContent("Resuelve:\n\\[x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}\\]")
assert.match(square, /\$\$\s*x=\\frac/)
assert.match(square, /\\sqrt\{b\^2-4ac\}/)
assert.doesNotMatch(square, /\\\[/)

const inline = prepareRichChatContent("Si \\(\\Delta > 0\\), hay dos raíces.")
assert.equal(inline, "Si $\\Delta > 0$, hay dos raíces.")

const legacy = prepareRichChatContent("[ x=\\frac{-b}{2a} ]")
assert.match(legacy, /\$\$\s*x=\\frac/)

const fenced = prepareRichChatContent("Código:\n" + "```python\n" + "print(r'\\[x\\]')\n" + "```\n" + "Fuera: \\(x\\)")
assert.match(fenced, /print\(r'\\\[x\\\]'\)/)
assert.match(fenced, /Fuera: \$x\$/)

const mixed = prepareRichChatContent("Precio: $1.000; ecuación: $$x^2=4$$")
assert.equal(mixed, "Precio: $1.000; ecuación: $$x^2=4$$")

console.log("Rich chat LaTeX: OK")
