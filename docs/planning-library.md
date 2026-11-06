# Biblioteca privada de planificaciones

Educador y Planificador Curricular buscan primero una coincidencia privada con la misma configuración, conversación y versión curricular. Una coincidencia evita la llamada de generación; las fechas, OA y contexto forman parte de la identidad. Solo se adaptan nombres de presentación cuando es seguro.

Las correcciones se leen directamente de saved_plannings. El trigger SQL sincroniza guardados, ediciones y eliminaciones con eduai_assets, sin publicar documentos ni compartirlos entre usuarios. Las generaciones no equivalen a aprobación docente. Los documentos antiguos se incorporan como referencias, sin inventar firmas curriculares.

Cuando no hay coincidencia se recuperan hasta tres fragmentos de documentos propios, filtrados por curso, asignatura y OA, mediante búsqueda PostgreSQL. No requiere embeddings ni llamadas adicionales a modelos. La opción Aprovechar mis documentos guardados permite desactivar reutilización y referencias.

Los proveedores Google y compatibles informan tokens reales cuando están disponibles; desconocidos quedan en null. Una reutilización registra cero tokens y generación evitada. Esto es memoria de documentos y recuperación contextual, no entrenamiento automático de pesos. No implementa regeneración por sección.

## Activación

Aplicar sql/planning-library.sql mediante la migración confirmada de Supabase. Es aditiva, usa funciones security invoker y conserva RLS por propietario. Antes de activar, ejecutar las pruebas de aislamiento y verificar índices y funciones. El código degrada a generación normal si las funciones todavía no existen.

## Verificación

npm run test:planning-library comprueba identidad, aislamiento, correcciones en vivo, invalidación curricular, generación nueva, referencias limitadas, contadores ejecutados y normalización de tokens. CI también ejecuta TypeScript y build completo.

Para invalidar todas las coincidencias tras cambiar prompts, incrementar EDUAI_DOCUMENT_LIBRARY_REVISION. Los ahorros de tokens solo pueden calcularse con uso informado; no se estima consumo histórico ausente.
