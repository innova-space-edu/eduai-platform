import { readFileSync, writeFileSync } from "node:fs";

const filePath = "components/exam/ExamQuestionNotebook.tsx";
let source = readFileSync(filePath, "utf8");

source = source.replace(
  'const RECOGNITION_DEBOUNCE_MS = 700;',
  'const RECOGNITION_DEBOUNCE_MS = 0;',
);

source = source.replace(
  '  const [feedback, setFeedback] = useState("Escribe tu desarrollo. El LaTeX se actualizará después de una pausa breve.");',
  '  const [feedback, setFeedback] = useState("Escribe tu desarrollo. El lienzo se guarda al instante; el LaTeX se genera al guardar o entregar.");',
);

source = source.replace(
  `  const scheduleRecognition = useCallback((nextStrokes: Stroke[], pageId: string) => {
    if (recognitionTimer.current) clearTimeout(recognitionTimer.current);
    setRecognitionQueued(true);
    setFeedback("Se actualizará el LaTeX cuando hagas una pausa breve...");
    recognitionTimer.current = setTimeout(() => void recognize(nextStrokes, pageId), RECOGNITION_DEBOUNCE_MS);
  }, [recognize]);`,
  `  const scheduleRecognition = useCallback((_nextStrokes: Stroke[], _pageId: string) => {
    if (recognitionTimer.current) clearTimeout(recognitionTimer.current);
    recognitionAbortRef.current?.abort();
    setRecognitionQueued(false);
    setFeedback("✅ Trazos guardados. El LaTeX se generará al guardar, cambiar de pregunta o entregar.");
  }, []);`,
);

source = source.replaceAll(
  'updatePage(activePage.id, (page) => ({ ...page, strokes: nextStrokes, updatedAt: new Date().toISOString() }));',
  'updatePage(activePage.id, (page) => ({ ...page, strokes: nextStrokes, latex: "", ocrText: "", ocrConfidence: null, updatedAt: new Date().toISOString() }));',
);

source = source.replaceAll(
  'updatePage(activePage.id, (page) => ({ ...page, strokes: next, updatedAt: new Date().toISOString() }));',
  'updatePage(activePage.id, (page) => ({ ...page, strokes: next, latex: "", ocrText: "", ocrConfidence: null, updatedAt: new Date().toISOString() }));',
);

source = source.replaceAll(
  'updatePage(activePage.id, (page) => ({ ...page, strokes: previous, updatedAt: new Date().toISOString() }));',
  'updatePage(activePage.id, (page) => ({ ...page, strokes: previous, latex: "", ocrText: "", ocrConfidence: null, updatedAt: new Date().toISOString() }));',
);

source = source.replace(
  `    async finalizeArtifact() {
      return { ...getArtifact(), previewPngDataUrl: await exportPng() };
    },`,
  `    async finalizeArtifact() {
      let artifact = getArtifact();
      let finalPages = artifact.pages;
      if (finalPages.some((page) => page.strokes.length > 0 && !page.latex.trim())) {
        setRecognizing(true);
        setFeedback("Generando LaTeX final del lienzo...");
        const nextPages: ExamNotebookPage[] = [];
        for (const page of finalPages) {
          if (!page.strokes.length || page.latex.trim()) {
            nextPages.push(page);
            continue;
          }
          try {
            const response = await fetch("/api/whiteboard/recognize", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ strokes: page.strokes }),
            });
            const data = await response.json().catch(() => ({}));
            nextPages.push({
              ...page,
              latex: typeof data?.latex === "string" ? data.latex : "",
              ocrText: typeof data?.text === "string" ? data.text : "",
              ocrConfidence: typeof data?.confidence === "number" ? data.confidence : null,
              updatedAt: new Date().toISOString(),
            });
          } catch {
            nextPages.push(page);
          }
        }
        finalPages = nextPages;
        setPages(finalPages);
        artifact = {
          ...artifact,
          pages: finalPages,
          latex: combineLatex(finalPages),
          ocrText: combineOcrText(finalPages),
          ocrConfidence: averageConfidence(finalPages),
          updatedAt: new Date().toISOString(),
        };
        setRecognizing(false);
        setFeedback(artifact.latex ? "✅ LaTeX final generado y lienzo guardado." : "✅ Lienzo guardado como evidencia. El LaTeX podrá generarse después.");
      }
      return { ...artifact, previewPngDataUrl: await exportPng() };
    },`,
);

source = source.replace(
  '  const recognitionStatusLabel = recognizing ? "Reconociendo..." : recognitionQueued ? "Actualización pendiente" : "Guardado automático";',
  '  const recognitionStatusLabel = recognizing ? "Generando LaTeX..." : activePage.latex ? "LaTeX generado" : activePage.strokes.length ? "Trazos guardados" : "Guardado automático";',
);

source = source.replace(
  '        <button type="button" onClick={recognizeNow} disabled={recognizing || !activePage.strokes.length} className="flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-bold text-emerald-700 disabled:opacity-40"><RefreshCw size={14} /> Actualizar LaTeX</button>',
  '        <button type="button" onClick={recognizeNow} disabled={recognizing || !activePage.strokes.length} className="flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-bold text-emerald-700 disabled:opacity-40"><RefreshCw size={14} /> Generar LaTeX ahora</button>',
);

writeFileSync(filePath, source);
