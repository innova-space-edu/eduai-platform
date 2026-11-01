# Rescate de proyectos de EduAI Multimedia (01-11-2026)

## Antes de intentar recuperación
No borrar datos del navegador, no eliminar almacenamiento del sitio y no
reinstalar el navegador. El borrador de la línea de tiempo podría ser la
única copia. La recuperación de videos originales exige que estén aún en el
equipo o en la nube: un JSON de edición no contiene automáticamente el video.

## Cómo recuperar

1. Abrir la **misma dirección de EduAI y el mismo perfil del navegador** usado
   para editar. IndexedDB es local a cada perfil/origen.
2. Entrar en **Proyecto > Rescatar borradores**; descargar primero un respaldo
   JSON y luego restaurar el borrador más reciente que tenga la línea de tiempo.
   La recuperación crea una edición nueva; no pisa un proyecto ya guardado.
3. Entrar en **Archivos > Cargar o arrastrar** y seleccionar de una sola vez
   los archivos originales marcados «Falta volver a enlazar». Se reconocen por
   nombre y tipo sin sustituir los IDs que usan los clips.
4. Guardar en EDUAI; observar explícitamente si indica **Nube y navegador**
   o **Solo navegador**. En el segundo caso, guardar también **Proyecto JSON**.
5. Seleccionar **WebM** si el navegador no ofrece MP4 directamente; revisar
   resolución y memoria disponible para un proyecto 4K.
6. Exportar solo después de resolver los medios faltantes: el editor
   bloquea exportaciones incompletas en lugar de producir un video negro.

## Qué corrige la PR
- La carga del borrador deja de sobrescribirse inicialmente con un proyecto vacío.
- El navegador conserva snapshots JSON anteriores sin borrar el original.
- IndexedDB reciente gana frente a una copia vieja de Supabase.
- Si falla un archivo cloud, se intenta rescatar el Blob local del mismo ID.
- No se bloquea la copia cloud cuando IndexedDB llega a su cuota.
- Enlace múltiple de archivos es coherente y guardado indica su destino real.
- Exportación detecta archivos faltantes y rechaza resultados vacíos.

## Límites
Los archivos externos borrados o los Blobs ya eliminados de IndexedDB no
pueden recrearse solo con el JSON. Las descargas aún dependen de que el
navegador admita el formato, la memoria y el MediaRecorder usado.
