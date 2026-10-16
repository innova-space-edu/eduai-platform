# EDUAI Diseño Pro + Edu Claw: skills, proveedores, incidencias (16-10-2026)

## Qué se construyó
1. Reutiliza la skill de @innova-space/visual-design; no crea un motor de dibujo duplicado.
2. Añade biblioteca local de referencias visuales (voxel, pixel art, cómic, ciencia, portada, póster, acuarela, isométrico, etc.) y tipos de piezas con selección manual o detección automática. Ejemplo: Mario Bros saltando en una selva con estética Minecraft conserva protagonista/acción y agrega reglas voxel coherentes.
3. Diseño Pro aplica un brief local estructurado siempre; cuando la optimización IA está activada por defecto, ejecuta /api/image-studio/pro/optimize y, si falla, continúa con el brief local.
4. /api/agents/imagenes reutiliza los proveedores reales ya existentes. Solo Diseño Pro puede añadir una lista de alternativas si el usuario marcó expresamente permitir fallback. Con texto crítico, los alternativos priorizan proveedores del grupo de fidelidad. No garantiza resultados idénticos.
5. Eventos de cuota, token, timeout, indisponibilidad, fallo genérico, errores de guardado y optimizador se registran en la base privada de incidencias. No se guardan prompts, identificadores de usuario, imágenes, claves o respuestas brutas.
6. Campana global solo administradores: acceso comprobado por sesión Supabase y public.admin_emails en cada API; sin datos públicos, sin frontend con service_role. Actualiza al navegar, volver a pestaña y a intervalos visibles de 2 minutos. Puede reconocer, resolver o completar tareas. Los incidentes duplicados actualizan occurrences y last_seen_at sin insertar una fila nueva.
7. Edu Claw registra y presenta la telemetría real disponible de ai_provider_health y las tareas explícitamente documentadas. NO realiza un escaneo completo del servidor Dell apagado, no consulta proveedores externos a cada visita y no certifica que servicios no instrumentados estén operativos.

## Datos Supabase
Migración: supabase/migrations/20261016153000_eduai_admin_claw_incidents.sql
- public.eduai_admin_incidents: fingerprint único, category, severity, provider, module, status, first_seen_at, last_seen_at, occurrences, timestamps y metadata vacía por defecto.
- public.eduai_admin_tasks: backlog verificable, status, prioridad y fechas.
- Función public.eduai_record_admin_incident(...), SECURITY DEFINER y solo execute para service_role.
- Tablas con RLS habilitado y sin permisos de lectura/escritura para anon o authenticated. Cualquier modificación ocurre mediante API autenticada y comprobación del rol admin.
- Semilla de tres tareas conocidas: validación Bonsai, reanudar Kaggle MCP y benchmarks de proveedores. No se generan incidencias falsas.

## Reglas de seguridad y costos
- Optimización automática puede generar gasto de tokens; el switch informa ese costo y permite desactivar.
- Fallback puede usar proveedor de costo distinto; está habilitado por defecto en UI Diseño Pro y requiere que el envío explícito incluya allowProviderFallback=true. Otros clientes de Image Studio conservan el comportamiento previo.
- Fallas de supabase para alertas no detienen la generación de imágenes; deben observarse en logs del servidor y en la salud del producto.
- El proveedor preferido sigue siendo el primero cuando el usuario lo selecciona.
- Solo el usuario puede cambiar la imagen en su sesión; no se retienen prompts en la tabla de incidentes.
- El botón Resolver es una confirmación humana de incidencia atendida, no una comprobación automática de cuota recuperada. Si vuelve a fallar, la misma incidencia se reabre.
- La supervisión no ejecuta correcciones, rotaciones de claves ni compras de créditos sin aprobación.

## Verificación
- npx tsx scripts/test-design-pro-edu-claw.ts
- npx tsc --noEmit --incremental false
- CI de Next.js y auditoría de producción.
- Prueba SQL transaccional verificada: dos eventos idénticos -> una fila y occurrences=2; rollback sin alerta persistente.
- Prueba administrativa real: iniciar sesión con admin_emails, comprobar campana y cambio de estados; usuario normal no debe ver/leer incidencias.
- Prueba de proveedor: inducir un error sintético en entorno de pruebas y comprobar fingerprint/cuenta; no alterar cuotas reales para pruebas.

## Pendiente para cobertura total
- Correlación de nuevas señales de GitHub Actions, Vercel, almacenamiento y tareas del servidor con conectores de solo lectura. Requiere autenticación de cada servicio y políticas de polling/privacidad; no está habilitada de forma implícita.
- Mejorar evidencia de recuperación de proveedor, evaluación de calidad por estilo, costos de fallback y clasificación semántica.
- Capturar métricas reales de los proveedores en QA y monitoreo proactivo sin almacenar material sensible.

## Despliegue
La migración a Supabase Edu-AI debe estar aplicada antes de publicar la campana. Tras aprobar PR y CI, el despliegue Vercel de main es automático según la integración del repositorio. Confirmar estado READY y sesión administrativa antes de considerar finalizada la implementación.
