# Acceso seguro a exámenes con listado de estudiantes

Este flujo permite generar códigos temporales para estudiantes que no recuerdan su RUT.

- La lista de estudiantes se guarda en Supabase, no en GitHub.
- Los códigos se guardan como hash.
- El estudiante no ve su RUT en la página pública.
- La página docente para generar códigos queda en `/admin/exam-access`.

Antes de usarlo en producción, aplica la migración `supabase/migrations/20260616000000_secure_student_roster_access_codes.sql` y agrega `EXAM_ACCESS_CODE_SECRET` en Vercel.