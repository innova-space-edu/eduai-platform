# SambaNova · integración modular (EDUAI AI Core)

## Objetivo y alcance

SambaNova se incorpora como **nuevo proveedor** del AI Gateway, sin eliminar, editar
ni sustituir las integraciones de Google/Gemini, Groq, OpenRouter, Together y Cerebras.
Se registra el catálogo de seis modelos de https://cloud.sambanova.ai/apis.
La migración crea también **candidatos** en Model Lab. El catálogo visible no implica
que la cuenta disponga de acceso a cada modelo.

No se activan llamadas de producción por el mero despliegue. El adaptador de
SambaNova sólo se habilita cuando el administrador establece
`EDUAI_SAMBANOVA_ENABLED=true` **y** alguna clave privada pertinente.
Por defecto Gemini conserva la primera prioridad por capacidad.

## Variables privadas (Vercel / runtime servidor)

```env
# Credencial privada principal; nunca NEXT_PUBLIC_*.
SAMBANOVA_API_KEY=
# Una API key aislada opcional para la evaluación administrativa.
SAMBANOVA_API_KEY_MODEL_LAB=
# Claves separadas opcionales por herramienta EDUAI.
SAMBANOVA_API_KEY_CLAW=
SAMBANOVA_API_KEY_EDUCADOR=
SAMBANOVA_API_KEY_EXAMENES=
SAMBANOVA_API_KEY_MIRA=
SAMBANOVA_API_KEY_TRADUCTOR=
SAMBANOVA_API_KEY_PLANIFICACION=
SAMBANOVA_API_KEY_NOTEBOOK=
SAMBANOVA_API_KEY_CHAT_PAPER=
SAMBANOVA_API_KEY_AGENTES=
SAMBANOVA_API_KEY_IMAGE_STUDIO=
SAMBANOVA_API_KEY_AUDIO_LAB=
SAMBANOVA_API_KEY_CREATOR=
SAMBANOVA_API_KEY_MATEMATICO=
SAMBANOVA_API_KEY_TUTOR=

# Activación explícita sólo tras pruebas de privacidad, costes y conectividad.
EDUAI_SAMBANOVA_ENABLED=false
SAMBANOVA_TEXT_MODEL=gpt-oss-120b
SAMBANOVA_STRUCTURED_MODEL=gpt-oss-120b
```

**No crear claves innecesarias**. El administrador debe crearlas en su cuenta
SambaNova y colocarlas en secretos servidor. Nunca almacenarlas en el código,
en Supabase expuesto al navegador, en localStorage ni en una solicitud cliente.
Las cuotas de SambaNova son por cuenta y modelo, no por cantidad de claves.

Cada módulo puede además utilizar su propio **orden de proveedores**, definido con
`EDUAI_AI_PROVIDER_ORDER_<MODULO>_<CAPABILITY>`, por ejemplo:

```env
EDUAI_AI_PROVIDER_ORDER_CLAW_TEXT=groq,sambanova,google,openrouter
EDUAI_AI_PROVIDER_ORDER_EXAMENES_TEXT=google,sambanova,groq
EDUAI_AI_PROVIDER_ORDER_NOTEBOOK_LONG_CONTEXT=google,sambanova,openrouter
```

Si no hay override, se conserva el orden global. Si un override de módulo omite
Google, se conserva Google al final como respaldo. Las rutas con un proveedor
preferido solo intentan otros cuando `fallbackToDefault=true`; ese respaldo se
activa específicamente en Matemático, Traductor Voz, Tutor y pulido de Notebook.

El adaptador OpenAI-compatible también acepta una clave por módulo para otros
proveedores, con el patrón `GROQ_API_KEY_CLAW`,
`OPENROUTER_API_KEY_CLAW`, `TOGETHER_API_KEY_CLAW`,
`CEREBRAS_API_KEY_CLAW` y así sucesivamente con los sufijos controlados.
Si la clave del módulo no existe, el proveedor conserva su variable original
(`GROQ_API_KEY`, `OPENROUTER_API_KEY`, `TOGETHER_API_KEY`,
`CEREBRAS_API_KEY`). Gemini y sus variables existentes permanecen
intactos. Cada integración de Gemini conserva su configuración habitual.

Para utilizar la clave de un módulo, la llamada *server-side* debe indicar ese
módulo en `context: { module: "claw", ... }` de `runAIText`,
`runAIStructured` o `streamAIText`. Si la herramienta no transmite su nombre
al Gateway, utilizará la clave general de ese proveedor. Esto permite migrar
las herramientas por etapas sin intervenir en sus flujos ya estables.

## Flujo de activación sugerido

1. Crear una API key `EDUAI Model Lab` en SambaNova; seleccionar vencimiento.
2. Configurar `SAMBANOVA_API_KEY_MODEL_LAB` en Vercel **Preview**, no en frontend.
3. Aplicar la migración Supabase `20261017183000_sambanova_model_catalog.sql`.
4. Ejecutar smoke tests administrativos de cada uno de los seis modelos en
   `/admin/model-lab`; 402/403/404/429 no equivalen a aprobación del modelo.
5. Comparar calidad, latencia, coste, soporte de herramientas y límites con
   Gemini, Groq, OpenRouter, Together y Cerebras usando el mismo conjunto de tareas.
6. Tras verificación de términos, seguridad y límites, asignar claves por módulo.
7. Activar `EDUAI_SAMBANOVA_ENABLED=true` en el entorno elegido. Las cadenas
   conservadoras tienen **Gemini primero** y SambaNova al final para texto,
   JSON estructurado, contexto largo y código. El orden por capacidad sigue siendo
   configurable con `EDUAI_AI_PROVIDER_ORDER_<CAPABILITY>`, por ejemplo
   `EDUAI_AI_PROVIDER_ORDER_TEXT=google,groq,sambanova,openrouter,cerebras,together`.

## Compatibilidad y limitaciones

- OpenAI-compatible chat endpoint:
  `https://api.sambanova.ai/v1/chat/completions`.
- IDs exactos: `DeepSeek-V3.1`, `DeepSeek-V3.2`,
  `Meta-Llama-3.3-70B-Instruct`, `MiniMax-M3`, `gemma-4-31B-it`,
  `gpt-oss-120b`.
- Solo se conecta **texto/chat y JSON** al Gateway. Aunque Gemma 4 y
  MiniMax M3 se anuncian como capaces de visión, **no existe aún un adaptador
  de imágenes para SambaNova**. No se activa como fallback en la ruta `vision`.
- La prueba smoke mide disponibilidad básica, **no calidad ni razonamiento**.
- El failover de texto/JSON funciona para respuestas fallidas antes de completar;
  no es seguro reanudar una respuesta streaming parcialmente emitida.
- Usar datos sintéticos en pruebas; revisar contratos y protección de datos antes
  de enviar datos personales de estudiantes o de terceros a un nuevo proveedor.
- Los proveedores/modelos preview pueden cambiar y algunos exigen pago.
- **No cambiar** audio, imagen, video, TTS ni rutas exclusivas de Gemini hasta
  disponer de un adaptador equivalente, pruebas y autorización.
