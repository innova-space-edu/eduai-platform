# EDUAI Video Studio — mantenimiento sin servicio (12-10-2026)

Estado: módulo de generación de video todavía no lanzado, mantenido visible solo como **En mantenimiento** en el catálogo; el acceso directo muestra aviso sin controles de generación ni pagos.

- Supabase: `ai_billing_settings.id = 1`, `payments_enabled = false` y `premium_video_enabled = false` (aplicado).
- Next.js: interruptor `VIDEO_STUDIO_MAINTENANCE=true`, con HTTP 503 y código `VIDEO_STUDIO_MAINTENANCE` para creación de video gratuito, premium y personal, preparación de pago, pago y estimación.
- Procesamiento automático de cola: desactivado. Los endpoints de estado únicamente consultan el historial; no ejecutan proveedores mientras dure la suspensión.
- Conservar historial de órdenes, wallets, transacciones, costos de generación y trabajos previos. Webhook y conciliación de Mercado Pago permanecen disponibles para resolver movimientos históricos, contracargos o devoluciones.
- RAT E17: actividad técnica existe, pero no debe presentarse como servicio de pago lanzado. Documentar suspensión y conservación R14. No borrar registros ni afirmar que no existen.
- No afecta editor multimedia, análisis/resumen de video, audio/transcripción, música, imágenes ni otras áreas de EDUAI.

Para reactivar: validación técnica de proveedores, seguridad, pruebas de generación y cobros, revisión contractual/tributaria y decisión explícita del administrador. Deben ajustarse el interruptor y la configuración Supabase de forma coordinada antes de ofrecer generación al público.
