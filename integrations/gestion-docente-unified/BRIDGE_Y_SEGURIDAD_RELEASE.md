# Gestión Docente — Cloudflare ↔ Dell: contrato de conexión y bloqueo de salida
Estado: código candidato probado en staging, NO desplegado en Cloudflare ni en el host Dell.

## Un solo acceso
El usuario utiliza únicamente `https://gestion-docente.innova-space-edu.cl`. Cloudflare sirve login EDUAI y EDUAI Connect; las rutas `/workspace/**` se envían al backend privado Dell mediante HTTPS protegido por Cloudflare Access. Esto no constituye otro producto ni requiere Netlify.

## Requisitos obligatorios
- Worker Cloudflare con `GESTION_DELL_ORIGIN` = origen HTTPS dedicado del túnel privado al Dell.
- `GESTION_BRIDGE_HMAC_KEY` secreto aleatorio de 32+ bytes exclusivo de Gestión Docente, disponible solamente en Worker y backend Dell.
- Cloudflare Access service token específico para ese recurso: `GESTION_ACCESS_CLIENT_ID` y `GESTION_ACCESS_CLIENT_SECRET` del Worker.
- Dell verifica primero autenticidad Cloudflare Access, luego HMAC de método+ruta+query+SHA256 cuerpo+timestamp+UUID usuario, tolerancia máxima ±2 minutos, nonce consumido atómicamente en PostgreSQL y pertenencia escolar vigente con permiso por recurso.
- La identidad pública de EDUAI debe venir del JWT validado por servidor, jamás de un encabezado del navegador. Prohibido enviar al Dell la cookie EDUAI o el token de usuario como cabecera proxy.
- Cada GET/POST revalida RLS/autorización. No guardar archivos de usuarios sin ClamAV real ni metadatos persistentes.
- Ruta de acceso sin túnel o sin credenciales debe fallar en 503; nunca redirigir a Supabase Storage como respaldo silencioso.
- Hacer pruebas de bloqueo de requests falsificados, nonce repetido, modificaciones de cuerpos, acceso entre colegios, usuarios revocados y fallos del antivirus.

## Código
- `cloudflare-gateway.mjs`: candidato de Worker con proxy firmado a Dell. Sólo Web Crypto, sin acceso a Node filesystem.
- `dell-bridge-verifier.mjs`: valida firma, SHA-256, caducidad y nonce de la solicitud recibida.
- `cloudflare-gateway.test.mjs`: 13 pruebas del contrato en simulador, sin credenciales reales ni envío de información.
- **No reemplazar aún el Worker de producción**. Los adaptadores de Auth real y los permisos Dell todavía deben implementarse y comprobarse.

## Seguridad de exámenes EDUAI (bloqueante)
- Auditoría de solo lectura a Supabase EDUAI 2026-11-20:
  - `teacher_exams` tiene política `Public read active exams` en rol `public` con condición `status = 'active'`.
  - `anon` posee SELECT concedido a nivel de tabla.
  - Hay cinco exámenes activos; tres contienen claves JSON con nombres compatibles con respuestas/corrección.
- Esto crea riesgo de exposición de preguntas/pautas de exámenes activos mediante lectura anónima de la tabla.
- Revisar primero rutas de estudiantes y docentes, pruebas de ingreso por códigos y eventuales dependencias directas. En el código actual `app/api/exam-access/route.ts` ya utiliza servicio del servidor para validar códigos.
- En una ventana de seguridad controlada: revocar política pública de lectura de exámenes activos y ofrecer únicamente acceso con códigos autorizados a través del servidor, sin incluir pautas. Guardar migración reversible, respaldo y pruebas E2E.
- **No se ha modificado la política real** para no interrumpir 5 exámenes activos sin plan de compatibilidad.

## Operación real Dell
El MCP administrativo actual no permite ejecutar shell sobre el host arbitrariamente ni crear una base nueva desde el espacio de trabajo. El catálogo de despliegues sólo muestra los proyectos existentes de intranet/ClamAV. El propietario debe aprobar la instalación de la nueva API y las credenciales desde el canal seguro del servidor antes de su activación.

## Estado del producto
Las pruebas Node/SQLite, PostgreSQL 17 en GitHub Actions y antivirus simulado no garantizan producción. Resta autorización host, instalación Dell, ClamAV real, restauración del backup, Google OAuth y ensayos E2E.
