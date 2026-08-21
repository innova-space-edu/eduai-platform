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
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )

  const groqBindings = new Set()
  const supabaseCreateClientBindings = new Set()

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    const moduleName = statement.moduleSpecifier.getText(sourceFile).replace(/["']/g, "")

    if (moduleName === "groq-sdk") {
      const defaultImport = statement.importClause?.name
      if (defaultImport) groqBindings.add(defaultImport.text)
      continue
    }

    if (moduleName === "@supabase/supabase-js") {
      const bindings = statement.importClause?.namedBindings
      if (!bindings || !ts.isNamedImports(bindings)) continue
      for (const element of bindings.elements) {
        const importedName = element.propertyName?.text || element.name.text
        if (importedName === "createClient") supabaseCreateClientBindings.add(element.name.text)
      }
    }
  }

  function addViolation(node, provider) {
    const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
    violations.push({
      provider,
      location: `${path.relative(root, filePath)}:${pos.line + 1}:${pos.character + 1}`,
    })
  }

  function visit(node) {
    if (!isInsideFunction(node)) {
      if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        groqBindings.has(node.expression.text)
      ) {
        addViolation(node, "Groq")
      }

      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        supabaseCreateClientBindings.has(node.expression.text)
      ) {
        addViolation(node, "Supabase")
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
}

if (violations.length) {
  throw new Error(
    `[provider-client-init] Los clientes que dependen de secretos/configuración no pueden inicializarse a nivel de módulo. Mueve la creación al handler/factory:\n${violations
      .map((item) => `${item.provider}: ${item.location}`)
      .join("\n")}`,
  )
}

console.log("[provider-client-init] no hay clientes Groq/Supabase sensibles inicializados a nivel de módulo en app/api")
