# Gestión Docente — infraestructura definitiva (sin Netlify)

**Una sola aplicación:** `https://gestion-docente.innova-space-edu.cl`.

- **Acceso y navegación:** Cloudflare Worker `gestion-docente`.
- **Identidad:** cuenta EDUAI (Supabase Auth); permisos escolares revalidados en Dell.
- **Persistencia de archivos:** almacenamiento cifrado privado del Dell, con escaneo ClamAV.
- **Tareas, formularios y ACL:** PostgreSQL 17 en Dell, con registros de auditoría.
- **EDUAI Connect:** en el mismo dominio y sesión.
- **Copia de seguridad:** disco externo Dell y respaldo adicional fuera de ese servidor.
- **Netlify:** no se utiliza para construir, alojar ni desplegar Gestión Docente. El status `netlify/eduai-pl/deploy-preview` que pueda aparecer en GitHub pertenece a una integración externa preexistente del repositorio. No configura ni autoriza un despliegue de Gestión Docente.
- **Vercel:** se mantiene para la plataforma principal EDUAI, no para los archivos y backend de Gestión Docente.
- **Pruebas:** GitHub Actions sin despliegue por cada cambio.

**Estado real:** el código fuente está integrado en una sola propuesta; todavía falta completar y probar el enlace Cloudflare ↔ Dell, PostgreSQL 17 real, ClamAV real, backups/restauración y OAuth Google. No usar datos institucionales en el prototipo.

**Publicación única:** solo tras pasar todos los controles de seguridad, hacer una actualización controlada del Worker `gestion-docente`. No se publicará en Netlify ni se utilizarán sus URLs de preview como producto.
