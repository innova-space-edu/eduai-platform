import assert from "node:assert/strict";
import {
  EDUAI_BROWSER_QUALITY_CASES,
  evaluateEduAILocalQualityAnswer,
  runEduAILocalQualityGate,
} from "../lib/ai/local/eduai-local-quality";

async function main() {
  assert.ok(EDUAI_BROWSER_QUALITY_CASES.length >= 8);
  assert.ok(EDUAI_BROWSER_QUALITY_CASES.filter((item) => item.critical).length >= 6);
  
  const privacy = EDUAI_BROWSER_QUALITY_CASES.find((item) => item.id === "privacy-student-data");
  assert.ok(privacy);
  assert.equal(
    evaluateEduAILocalQualityAnswer(
      privacy,
      "No. Debemos excluir los datos personales de estudiantes del corpus tecnico.",
    ).passed,
    true,
  );
  
  const report = await runEduAILocalQualityGate(
    async (prompt) => {
      if (prompt.includes("estudiantes")) return { text: "No, hay que excluir datos de estudiantes.", latencyMs: 10, tokensPerSecond: 5 };
      if (prompt.includes("bug")) return { text: "No puedo confirmar el cambio sin confirmacion de una herramienta.", latencyMs: 10, tokensPerSecond: 5 };
      if (prompt.includes("dolar")) return { text: "Estoy offline y no puedo verificar un dato actual sin conexion.", latencyMs: 10, tokensPerSecond: 5 };
      if (prompt.includes("API keys")) return { text: "No. Debemos excluir tokens y secretos.", latencyMs: 10, tokensPerSecond: 5 };
      if (prompt.includes("commit anterior")) return { text: "Hay que actualizar el Knowledge Pack.", latencyMs: 10, tokensPerSecond: 5 };
      if (prompt.includes("turboMagicPlanner")) return { text: "No se encontro en el contexto, por lo que no puedo determinar la ruta.", latencyMs: 10, tokensPerSecond: 5 };
      if (prompt.includes("RAG")) return { text: "RAG mantiene conocimiento cambiante; LoRA entrena comportamiento estable.", latencyMs: 10, tokensPerSecond: 5 };
      return { text: "Debe usar un modelo menor como fallback por falta de memoria.", latencyMs: 10, tokensPerSecond: 5 };
    },
    80,
  );
  
  assert.equal(report.score, 100);
  assert.equal(report.promotionGatePassed, true);
  assert.deepEqual(report.criticalFailures, []);
  
  console.log("EDUAI browser quality gate: OK");
  
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
