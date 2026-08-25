import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const editPath = path.join(root, "app/examen/editar/[id]/page.tsx");
const publicPath = path.join(root, "app/examen/p/[code]/page.tsx");

function requireAnchor(source, anchor, label) {
  if (!source.includes(anchor)) {
    throw new Error(`[periodic-table] No se encontró el ancla: ${label}`);
  }
}

function writeIfChanged(filePath, before, after) {
  if (before === after) {
    console.log(`[periodic-table] sin cambios: ${path.relative(root, filePath)}`);
    return;
  }
  fs.writeFileSync(filePath, after, "utf8");
  console.log(`[periodic-table] actualizado: ${path.relative(root, filePath)}`);
}

function patchTeacherEditor() {
  const before = fs.readFileSync(editPath, "utf8");
  let source = before;

  if (!source.includes("function isChemistryExamContext")) {
    const anchor = "const CALM_GREEN_COLORS = {";
    requireAnchor(source, anchor, "helper de contexto químico");
    const helper = `function normalizeSubjectForResource(value: unknown): string {\n  return String(value ?? \"\")\n    .toLowerCase()\n    .normalize(\"NFD\")\n    .replace(/[\\u0300-\\u036f]/g, \"\")\n}\n\nfunction isChemistryExamContext(settings: any, topic: string): boolean {\n  const subject =\n    settings?.subject ||\n    settings?.asignatura ||\n    settings?.curriculum?.subject ||\n    settings?.curriculum?.asignatura ||\n    topic ||\n    \"\"\n\n  return normalizeSubjectForResource(subject).includes(\"quimica\")\n}\n\n`;
    source = source.replace(anchor, helper + anchor);
  }

  if (!source.includes('updateSetting("allowPeriodicTable"')) {
    const anchor = "\n\n        {/* Colores solo para esta prueba */}";
    requireAnchor(source, anchor, "tarjeta de colores posterior a calculadora");
    const card = `\n\n        {/* Recurso de Química: tabla periódica */}\n        {isChemistryExamContext(settings, topic) ? (\n          <div className=\"rounded-2xl p-4 border\" style={{ background: \"var(--bg-card-soft)\", borderColor: \"var(--bg-card-soft)\" }}>\n            <div className=\"flex flex-col gap-4 md:flex-row md:items-center md:justify-between\">\n              <div>\n                <p className=\"text-main text-sm font-bold\">⚗️ Tabla periódica para estudiantes</p>\n                <p className=\"text-muted2 text-xs mt-1 leading-relaxed\">\n                  Recurso exclusivo para evaluaciones de Química. Al activarlo aparecerá un botón flotante durante la prueba\n                  y el estudiante podrá abrir la tabla periódica, ampliarla, reducirla y cerrarla cuando lo necesite.\n                </p>\n              </div>\n              <label className=\"flex items-center gap-3 rounded-2xl border border-soft bg-card-soft-theme px-4 py-3 text-sm font-semibold text-sub cursor-pointer\">\n                <input\n                  type=\"checkbox\"\n                  checked={settings?.allowPeriodicTable === true}\n                  onChange={(e) => updateSetting(\"allowPeriodicTable\", e.target.checked)}\n                />\n                {settings?.allowPeriodicTable === true ? \"Tabla periódica autorizada\" : \"Tabla periódica no autorizada\"}\n              </label>\n            </div>\n          </div>\n        ) : null}`;
    source = source.replace(anchor, card + anchor);
  }

  writeIfChanged(editPath, before, source);
}

function patchStudentExam() {
  const before = fs.readFileSync(publicPath, "utf8");
  let source = before;

  if (!source.includes('import ExamPeriodicTable from "@/components/exam/ExamPeriodicTable";')) {
    const anchor = 'import ExamScientificCalculator from "@/components/exam/ExamScientificCalculator";';
    requireAnchor(source, anchor, "import de calculadora");
    source = source.replace(
      anchor,
      `${anchor}\nimport ExamPeriodicTable from \"@/components/exam/ExamPeriodicTable\";`,
    );
  }

  if (!source.includes("const allowPeriodicTable =")) {
    const anchor = "  const allowCalculator = exam?.settings?.allowCalculator === true;";
    requireAnchor(source, anchor, "allowCalculator");
    const addition = `${anchor}\n  const periodicTableSubject = String(\n    exam?.settings?.subject ||\n      exam?.settings?.asignatura ||\n      exam?.settings?.curriculum?.subject ||\n      exam?.settings?.curriculum?.asignatura ||\n      exam?.topic ||\n      \"\",\n  )\n    .toLowerCase()\n    .normalize(\"NFD\")\n    .replace(/[\\u0300-\\u036f]/g, \"\");\n  const allowPeriodicTable =\n    exam?.settings?.allowPeriodicTable === true && periodicTableSubject.includes(\"quimica\");`;
    source = source.replace(anchor, addition);
  }

  if (!source.includes("allowPeriodicTable ? <ExamPeriodicTable")) {
    const anchor = '        {phase === "exam" && allowCalculator ? <ExamScientificCalculator /> : null}';
    requireAnchor(source, anchor, "render de calculadora");
    source = source.replace(
      anchor,
      `${anchor}\n\n        {phase === \"exam\" && allowPeriodicTable ? <ExamPeriodicTable /> : null}`,
    );
  }

  writeIfChanged(publicPath, before, source);
}

patchTeacherEditor();
patchStudentExam();

console.log("[periodic-table] integración lista");
