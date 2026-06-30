import { readFileSync, writeFileSync, existsSync } from "node:fs";

const target = "app/examen/editar/[id]/page.tsx";

if (existsSync(target)) {
  let source = readFileSync(target, "utf8");

  const importLine = 'import ExamPdfDownloadButton from "@/components/exam/ExamPdfDownloadButton"\n';
  if (!source.includes(importLine.trim())) {
    source = source.replace(
      'import ExamMathText from "@/components/ui/ExamMathText"\n',
      'import ExamMathText from "@/components/ui/ExamMathText"\n' + importLine,
    );
  }

  const marker = '<div className="flex items-center gap-2 flex-shrink-0">\n            <button onClick={copyLink}';
  const insert = '<div className="flex items-center gap-2 flex-shrink-0">\n            <ExamPdfDownloadButton\n              title={title}\n              topic={topic}\n              instructions={instructions}\n              questions={questions}\n              settings={settings}\n              totalPoints={totalPoints}\n            />\n            <button onClick={copyLink}';

  if (!source.includes('<ExamPdfDownloadButton')) {
    source = source.replace(marker, insert);
  }

  writeFileSync(target, source);
}
