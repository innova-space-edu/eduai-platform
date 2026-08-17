import fs from "node:fs"
import path from "node:path"
import ts from "typescript"

const root = process.cwd()
const apiRoot = path.join(root, "app", "api")

function listTypeScriptFiles(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return listTypeScriptFiles(full)
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : []
  })
}

function isFunctionBoundary(node) {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  )
}

function isInsideFunction(node) {
  for (let current = node.parent; current && !ts.isSourceFile(current); current = current.parent) {
    if (isFunctionBoundary(current)) return true
  }
  return false
}

const violations = []

for (const filePath of listTypeScriptFiles(apiRoot)) {
  const sourceText = fs.readFileSync(filePath, "utf8")
  if (!sourceText.includes("groq-sdk")) continue

  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )

  const groqBindings = new Set()
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    if (statement.moduleSpecifier.getText(sourceFile).replace(/["']/g, "") !== "groq-sdk") continue
    const defaultImport = statement.importClause?.name
    if (defaultImport) groqBindings.add(defaultImport.text)
  }

  if (!groqBindings.size) continue

  function visit(node) {
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      groqBindings.has(node.expression.text) &&
      !isInsideFunction(node)
    ) {
      const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
      violations.push(`${path.relative(root, filePath)}:${pos.line + 1}:${pos.character + 1}`)
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
}

if (violations.length) {
  throw new Error(
    `[provider-client-init] Groq no puede inicializarse a nivel de módulo porque rompe builds sin secretos. Mueve la creación al handler/factory:\n${violations.join("\n")}`,
  )
}

console.log("[provider-client-init] no hay clientes Groq inicializados a nivel de módulo en app/api")
