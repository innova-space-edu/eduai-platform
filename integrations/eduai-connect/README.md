# EDUAI Connect — servicio HTTP independiente

Módulo autónomo Node 22+, sin dependencias nuevas. No forma parte de las rutas Next.js de EduAI. Su código queda junto al contrato de DB en el PR de revisión, pero se ejecuta como proceso separado y puede trasladarse al repositorio de la otra web.

`node --test gateway.test.mjs` ejecuta pruebas con un upstream simulado. `node server.mjs` inicia solo en loopback con EDUAI_SUPABASE_URL y EDUAI_SUPABASE_PUBLISHABLE_KEY; nunca una service role. Sin secretos en el repositorio. Requiere las tres migraciones Connect aplicadas en Supabase. No publicar aún: falta BFF/autenticación PKCE real de la aplicación externa, autorización por aplicación y pruebas de integración con cuentas controladas.

## Rutas

- GET /api/connect/v1/status
- POST /api/connect/v1/requests (kind, scopes o source_id)
- GET /api/connect/v1/exams, /plannings, /documents
- GET /api/connect/v1/document-candidates
- GET /api/connect/v1/exams/:id, /plannings/:id, /documents/:id
- GET /api/connect/v1/admin/requests
- POST /api/connect/v1/admin/decisions (approve/reject/revoke/revoke_resource)

Todas salvo /health requieren Bearer JWT individual de EduAI; las RPC verifican sesión activa y rol/autorización; acciones administrativas requieren AAL2 y correo administrativo vigente. No confiar en claims decodificados localmente ni usar el token del administrador para leer recursos docentes. No solicitar que se peguen tokens en la web o chat. El futuro BFF conservará sesión del usuario del lado servidor, con cookies HttpOnly/Secure, protección CSRF, validación PKCE y desconexión. El gateway no habilita CORS. Rate limit local no distribuido. Auditar accesos de lectura sin registrar contenidos, tokens ni notas. No hay acceso a otros docentes, binarios ni calificaciones. La política pública heredada de exámenes sigue pendiente de remediación coordinada.

Un endpoint HTTP no crea por sí solo aislamiento por aplicación: actualmente las RPC también son invocables con JWT individual autorizado. Para otorgar acceso a aplicaciones de terceros, implementar registro de clientes, grant por app, sesión delegada revocable y validación en cada petición antes de publicar.
