# Experiencias de Parvularia: banco, diversidad y web

La generación y la sugerencia de actividades examinan las referencias activas del banco mediante paginación estable (250 filas por página; techo operativo 10.000, informado como lectura incompleta). No se envía el banco completo al modelo: se seleccionan hasta 18 referencias y se conservan fragmentos de inicio, desarrollo, cierre, recursos y evaluación. Se eliminaron tres llamadas de embeddings de consulta por planificación.

La compatibilidad exige subnivel y núcleo. Las adaptaciones nuevas incluyen eligible_levels para declarar explícitamente los cursos compatibles. Nunca se usa una referencia de bebés como sustituto automático para Transición. Se priorizan diversidad de fuentes y mecánicas, y se excluyen referencias utilizadas en las últimas 24 generaciones del usuario.

Las nuevas planificaciones estructuradas no recuperan una planificación completa anterior automáticamente. La educadora puede abrir sus documentos guardados cuando necesita conservarlos. La novedad se revisa contra memoria y dentro del documento; si una reparación no resuelve una repetición detectada, se informa un error recuperable en vez de presentar esa versión como verificada. Es una comparación léxica, no una garantía absoluta frente a paráfrasis.

La web se consulta únicamente si alguna jornada no reúne suficientes referencias diversas o falta cobertura de un subnivel. Se agrupan los vacíos en una sola búsqueda fundamentada con el proveedor Google ya configurado. La consulta contiene solo curso, núcleo y textos curriculares públicos; no incorpora nombres, establecimiento ni documentos privados. Se exige metadata de búsqueda y enlaces reales; si no están disponibles, se continúa sin atribuir una búsqueda inexistente. Las referencias web se almacenan en caché privada por siete días y su consumo se registra cuando el proveedor lo informa. Se muestran los enlaces en el resultado y se conservan al guardar. No se incorporan automáticamente al banco compartido.

## Ampliación verificada el 6 de noviembre de 2026

Se inspeccionaron colecciones de JUNJI e Integra y recursos de MINEDUC, Educarchile/CEDUCA y la Corporación para la Infancia de Santiago. El catálogo contiene 263 fuentes, de las que 129 sostienen 132 adaptaciones activas originales de EduAI. Otras 134 referencias permanecen inactivas hasta revisar su contenido. Nueve enlaces fallidos, administrativos o no interpretables figuran separados. No se afirma haber agotado toda la web ni haber convertido cada ficha de cada libro en una actividad.

El banco pasó de 725 a 857 actividades activas. Las nuevas adaptaciones cubren seis subniveles y los ocho núcleos. El reporte distingue cantidad de actividades únicas y elegibilidad para varios subniveles, sin multiplicar el total por edad. Las fichas antiguas no se copian; las adaptaciones corrigen materiales pequeños, cordones, envases de medicamentos, contacto sin permiso y otras decisiones inapropiadas al contexto. La revisión es asistida, no certificación institucional ni aprobación de una educadora.

No se inventaron OA oficiales para rellenar columnas. oa_text y oat_text de estas adaptaciones quedan vacíos; el propósito pedagógico se conserva por separado. Los OA/OAT oficiales seleccionados en el planificador siguen siendo la autoridad curricular.

## Reproducción y mantenimiento

- data/parvularia/web-2026-11/source-inventory.json: referencias y procedencia, sin texto íntegro de PDF.
- curation.tsv: decisiones y redacción de las adaptaciones.
- corpus.json: importación revisada.
- report.json: conteos y matriz de cobertura.
- excluded.json: exclusiones de la búsqueda.

Ejecutar python3 scripts/build-parvularia-web-corpus.py reconstruye el corpus y SQL a partir de los metadatos públicos y la curación. node scripts/import-parvularia-web.mjs realiza una importación administrativa insert-only con variables SUPABASE_URL y SUPABASE_SECRET_KEY o SUPABASE_SERVICE_ROLE_KEY. Nunca imprimir ni versionar claves. Las firmas impiden duplicar una importación y no se reemplaza material previo. No ejecutar refresh_parvularia_corpus_quality como sustituto de revisión: esa función puede reactivar material antes descartado.

Pruebas: node scripts/test-parvularia-bank.mjs y node scripts/test-parvularia-web-corpus.mjs. La importación en Supabase verificó 132 filas nuevas, 263 fuentes, ocho núcleos normalizados y las 48 combinaciones de subnivel/núcleo.
