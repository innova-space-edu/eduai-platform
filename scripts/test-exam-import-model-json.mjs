import test from "node:test";
import assert from "node:assert/strict";
import { parseExamModelJson } from "../lib/exam/import-model-json.mjs";
test("JSON import regression 1", () => assert.equal(parseExamModelJson("{\"questions\":[{\"question\":\"Calcular $\\sqrt{4}$ y $\\frac{1}{2}$\"}]}").questions[0].question, "Calcular $\\sqrt{4}$ y $\\frac{1}{2}$"));
test("JSON import regression 2", () => assert.equal(parseExamModelJson("{\"questions\":[{\"question\":\"$\\\\frac{2}{3}$\",\"explanation\":\"Línea 1\\nLínea 2\"}]}").questions[0].question, "$\\frac{2}{3}$"));
test("JSON import regression 3", () => assert.equal(parseExamModelJson("```json\n{\"questions\":[{\"question\":\"$\\sqrt{9}$\"}]}\n```").questions[0].question, "$\\sqrt{9}$"));
test("JSON import regression 4", () => assert.equal(parseExamModelJson("{\"questions\":[{\"question\":\"$\\unknown{3}$\"}]}").questions[0].question, "$\\unknown{3}$"));
test("truncated response is rejected without inventing questions", () => assert.throws(() => parseExamModelJson('{"questions":['), /formato de evaluación inválido/));
