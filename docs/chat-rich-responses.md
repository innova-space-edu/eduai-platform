# Respuestas enriquecidas de EDUAI

Esta implementación comparte un renderizador seguro para Claw, Matemático, Redactor, Investigador y Notebook. Work conserva su renderizador específico de contenido multimedia, pero convierte los delimitadores matemáticos heredados.

## Sintaxis de respuestas

- Fórmulas en línea: `$x^2 - 5x + 6 = 0$`.
- Fórmulas centradas: delimitadores `$$` en líneas separadas. También se admiten respuestas heredadas con `\(...\)` y `\[...\]`.
- Código: bloques Markdown identificados con lenguaje, por ejemplo `python`. Se permite copiar y descargar como `.py`.
- Python: el botón **Ejecutar Python** usa Pyodide cargado bajo demanda en un Web Worker dentro de un iframe `sandbox=allow-scripts` sin acceso al origen de EduAI. El usuario debe ejecutarlo explícitamente. Límite de código de 12 KB, salida máxima de 12 KB y tiempo máximo de 45 segundos. No se ejecuta código del modelo en Node.js ni en Vercel. Requiere Internet para cargar el runtime. No se garantiza instalación de todos los paquetes.
- Gráficas: generar un bloque Markdown con lenguaje `eduai-chart` y un JSON válido:
  - Parábola: `{"type":"quadratic","title":"Parábola","a":1,"b":-4,"c":3,"xMin":-2,"xMax":6}`
  - Barras: `{"type":"bar","title":"Resultados","labels":["A","B"],"values":[3,5]}`
  - Línea: `{"type":"line","title":"Evolución","labels":["E1","E2"],"values":[4,7]}`
  Los gráficos se crean en SVG (sin ejecución de JavaScript externo) y pueden exportarse como archivo vectorial.
- Canva: en Claw se puede **copiar y abrir Canva** para continuar un diseño manual. Exportar SVG proporciona material vectorial para editores compatibles. **No equivale a una integración con la API de Canva ni publica diseños automáticamente.**

## Seguridad y pruebas

No habilitar HTML arbitrario en el renderizador Markdown, no utilizar `eval` para las gráficas y no ejecutar Python en los procesos del servidor. Los gráficos utilizan especificaciones JSON validadas y límites de tamaño. La ejecución opcional de Python tiene aislamiento de origen y límites locales, pero no debe usarse como entorno para secretos o cómputos confiables.

Prueba rápida: `npx tsx scripts/test-rich-chat-content.ts`.

Pruebas manuales:
1. Solicitar la fórmula cuadrática con `\frac`, `\sqrt` y `\Delta`; verificar KaTeX sin comandos visibles.
2. Solicitar una parábola y comprobar gráfica y exportación SVG.
3. Solicitar un script Python con `print(2 + 2)`, ejecutarlo por acción explícita y comprobar salida `4`.
4. Copiar una respuesta de Claw para Canva y comprobar que el texto se copia y se abre Canva; no debe aparecer una confirmación de publicación.
5. Verificar que los chats de Notebook y los módulos de agentes muestran correctamente las fórmulas.
