# Control E13: clonación vocal exclusiva de administración (2026-10-12)

**Decisión:** solo cuentas EDUAI que consten como administradoras en `admin_emails` pueden entrar a clonación de voz, crear perfiles, subir muestras, procesar, escuchar renders o borrar muestras. Quedan excluidos usuarios docentes, estudiantes, apoderados y adultos sin privilegio administrativo. No se procesarán voces de menores en este módulo.

**Otros módulos de audio:** la transcripción, generación TTS genérica y creación de canciones conservan sus permisos propios; este control no los restringe.

**Defensa en profundidad:** interfaz sin vínculo para no administradores; rutas Next.js rechazan accesos; pasarela Cloud Run comprueba rol en Supabase; migración SQL usa RLS restrictiva en perfiles, sesiones, eventos, artefactos y buckets de voz, exigiendo MFA AAL2.

**E13 del RAT — texto corregido:**
- **Finalidad:** clonación de voz y síntesis de un perfil vocal por administrador autorizado, para fines internos definidos.
- **Titulares:** persona adulta titular de la voz, previo consentimiento informado; administrador autenticado. Exclusión de personas menores de edad como titulares de voz y de toda persona usuaria no administradora como operadora.
- **Datos:** audio de referencia, grabación de autorización, metadatos técnicos, identificador de modelo vocal y trazas de operaciones; potencial dato biométrico.
- **Base a concretar:** consentimiento específico, libre, informado y verificable del titular de la voz, además de evaluación de impacto previa y revisión de la Ley 21.719.
- **Destinatarios:** Supabase y proveedor vocal efectivamente utilizado, tras revisión contractual y territorial.
- **Conservación:** R12, hasta revocación o fin de finalidad; supresión comprobada de muestras, modelos y derivados.
- **Riesgo:** crítico. **Responsable interno:** Esthefano Gonzalo Morales Campaña (sujeto a ratificación societaria).

**Despliegue obligatorio:** fusionar y desplegar Next.js, aplicar migración Supabase en el proyecto correcto y desplegar el servicio independiente `google-audio-gateway`. La rama/PR no significa que los controles estén activos en producción. Validar 401/403 con cuentas no administradoras, sesión MFA, Storage, RPC y acceso directo a Cloud Run. Los registros vocales preexistentes de usuarios no administradores deben inventariarse y determinar su destino mediante procedimiento documentado, sin borrado indiscriminado.

**Limitación identificada:** RPC preexistentes `open_voice_security_session` y `accept_voice_cloning_terms` están implementadas fuera de las migraciones conocidas; siguen pudiendo registrar sesiones/términos a nivel de Postgres si se llaman directamente. Sin embargo, no conceden por sí solas acceso a las tablas de voz tras aplicar RLS. Revisar sus definiciones originales para añadir validación administrativa antes de certificar cumplimiento total.
