# Alcance y verificación del tratamiento de datos en integraciones IA — EDUAI

**Estado:** guía interna de comprobación. No es una certificación de funcionamiento ni una habilitación para tratar datos sensibles.  
**Fecha:** 11-10-2026  
**Producto:** EDUAI Platform · **Empresa:** Innova Space Edu SpA · **Canal de privacidad:** contacto@innova-space-edu.cl

## A. Finalidad autorizada para modelos de generación externos

Los modelos de IA integrados en EDUAI se utilizan como herramientas auxiliares para **crear materiales educativos, apoyar la redacción/planificación, elaborar propuestas pedagógicas, sintetizar información no sensible y responder consultas**. No se destinan a:

- analizar datos personales o sensibles de estudiantes y otros usuarios como finalidad propia;
- construir perfiles individuales o inferir condiciones PIE/NEE, psicológicas, médicas o familiares;
- adoptar decisiones disciplinarias, diagnósticas o administrativas sobre personas;
- entrenar o ajustar modelos externos a partir de datos identificables de usuarios por defecto.

Los datos de autenticación, cuentas, expedientes y archivos de la plataforma sí son tratamientos distintos, sujetos a políticas, permisos, retención y acuerdos institucionales.

## B. Hallazgos de revisión estática en el código

Se observan rutas en las que **mensajes o texto procedente de documentos** pueden viajar al gateway de IA:

| Componente del repositorio | Flujo observado | Qué falta comprobar |
|---|---|---|
| `lib/ai/gateway.ts` | El gateway entrega `input.messages` a proveedores configurados. | Conjunto exacto de modelos activos, filtrado de identificadores, registros y políticas reales de proveedores. |
| `app/api/agents/redactor/route.ts` | Construye mensajes desde historial reciente y entrada del usuario y llama a `runAIText`. | Si el historial o el mensaje incluyen datos de personas y si existe desidentificación antes del envío. |
| `lib/notebook/summarizer.ts` | Construye prompt a partir de `contextText` y lo envía a un modelo de texto. | Clasificación de fuentes, extracción de datos sensibles y eventual filtrado. |
| `app/api/agents/exam-import/route.ts` | Procesa documentos, incluidos PDF y DOCX, y utiliza integración de IA para tareas del módulo. | Qué fragmentos se envían efectivamente y si los archivos contienen identificadores o notas reales. |

**Conclusión limitada:** la arquitectura permite procesar contenido aportado por usuarios y enviarlo a proveedores de IA. No se ha demostrado que todos los flujos eliminen información personal antes de transmitirla. Estos hallazgos no indican que la plataforma esté destinada al perfilamiento de personas, sino que hay que verificar las salvaguardas para cumplir su finalidad declarada.

## C. Matriz de validación previa a aseveraciones públicas

| Prueba / control | Criterio para aprobar | Estado |
|---|---|---|
| Inventario de integraciones | Identificar proveedor, finalidad, payload, modelo, región, retención, entrenamiento y subencargados. | PENDIENTE |
| Datos de cuentas | Confirmar que el prompt de contenido general no incorpora automáticamente nombre, RUT, correo o perfiles de estudiantes. | PENDIENTE |
| Archivos adjuntos | Detectar/impedir/remover datos personales innecesarios antes de enviar texto o imagen a modelos externos. | PENDIENTE |
| Historial / memoria | Comprobar separación entre cuentas, instituciones y sesiones. | PENDIENTE |
| Modos de voz / imagen | Examinar riesgos de identificación en transcripciones, audio, fotografías y metadatos. | PENDIENTE |
| Logs y telemetría | Verificar que errores, logs de proveedores y trazas no copien contenido sensible. | PENDIENTE |
| Transferencias | Acreditar regiones, base jurídica, contrato/DPA y subencargados que correspondan. | PENDIENTE |
| Datos para entrenamiento | Acreditar configuración y términos de no entrenamiento, donde aplique, y evitar usar datos reales en pruebas. | PENDIENTE |
| Incidentes | Probar contención y notificación ante remisión accidental de identificadores. | PENDIENTE |

## D. Criterios de publicación

**Declaración aceptable hoy (política de finalidad):**

> Los modelos externos integrados en EDUAI están destinados a la generación de recursos educativos y a responder consultas de información. No están diseñados para utilizar datos personales o sensibles como finalidad de análisis, clasificación o entrenamiento. Las solicitudes o archivos que aporten los usuarios pueden contener accidentalmente datos identificables; por ello, las integraciones deben limitar los datos transmitidos y están sujetas a revisión técnica y contractual.

**Declaraciones que no deben publicarse sin evidencia verificable:**

- «EDUAI nunca transmite datos personales a un modelo externo».
- «Todos los mensajes, documentos e imágenes son anonimizados automáticamente».
- «Ningún proveedor conserva o entrena con datos de solicitudes».
- «Toda integración IA cumple plenamente la Ley 21.719», sin evaluar sus condiciones concretas.

## E. Activación y seguimiento

La documentación **no implementa** filtros ni bloqueos. Antes de confirmar técnicamente la promesa de ausencia de datos personales se requiere instrumentación, pruebas y revisión del gateway, archivos, almacenamiento y proveedores. Las evidencias (sin datos personales reales) deben incluir fechas, versión de integración, resultados, riesgos residuales y aprobación del responsable técnico y de privacidad.

Como material corporativo complementario, revisar la propuesta legal de Innova Space Edu SpA en su repositorio institucional; mantenerla identificada como borrador hasta aprobación y publicación formal.

**Referencia normativa:** [Ley 21.719](https://www.bcn.cl/leychile/navegar?idNorma=1209272).  
**Referencias internas:** `docs/GOBERNANZA_IA.md`, `app/privacidad/page.tsx`, `app/gobernanza-ia/page.tsx`, `app/seguridad/page.tsx`.
