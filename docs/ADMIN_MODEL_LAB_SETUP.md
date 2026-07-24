# Admin Model Lab — configuración fase inicial

Este módulo agrega un laboratorio privado en `/admin/model-lab` para probar motores de generación visual antes de promoverlos a producción.

## Motores habilitados

- `fal-ai/flux-2/klein/4b`
- `fal-ai/z-image/turbo`

El backend fuerza la verificación de seguridad y valida el correo del usuario autenticado contra la tabla `admin_emails`.

## Variables de entorno

Agregar estas variables al proyecto desplegado:

```bash
ADMIN_MODEL_LAB_ENABLED=true
FAL_KEY=tu_clave_privada_de_fal
```

Para apagar inmediatamente el laboratorio:

```bash
ADMIN_MODEL_LAB_ENABLED=false
```

La clave `FAL_KEY` debe mantenerse únicamente en el servidor. No usar variables con prefijo `NEXT_PUBLIC_` para este valor.

## Migración Supabase

Ejecutar en Supabase SQL Editor:

```text
supabase/migrations/20260602000000_admin_model_lab_runs.sql
```

La migración crea la tabla privada `admin_model_lab_runs`, activa RLS y no expone policies públicas. Las inserciones se realizan desde el backend mediante `SUPABASE_SERVICE_ROLE_KEY`.

## Prueba manual

1. Iniciar sesión con un correo registrado en `admin_emails`.
2. Abrir `/admin/model-lab`.
3. Seleccionar `FLUX.2 Klein 4B` o `Z-Image Turbo`.
4. Escribir un prompt de prueba.
5. Elegir formato y semilla opcional.
6. Generar la imagen.
7. Verificar el registro en `admin_model_lab_runs`.

## Archivos principales

```text
app/admin/model-lab/page.tsx
app/admin/model-lab/model-lab-client.tsx
app/api/admin/model-lab/image/generate/route.ts
lib/ai/admin-model-policy.ts
supabase/migrations/20260602000000_admin_model_lab_runs.sql
```

## Controles incluidos

- acceso exclusivo para correos de `admin_emails`;
- whitelist de adapters ejecutables;
- verificación de seguridad forzada desde backend;
- límite de longitud del prompt;
- interruptor global por variable de entorno;
- auditoría de resultado, duración, semilla, adapter y flags de seguridad;
- fallback a logs cuando la tabla de auditoría todavía no ha sido creada.

## Pendientes para fases posteriores

- historial visual dentro del panel;
- comparación lado a lado entre modelos;
- edición de imágenes con referencias;
- mejora de resolución;
- integración de herramientas educativas STEM;
- pruebas de carga y CI del despliegue.
