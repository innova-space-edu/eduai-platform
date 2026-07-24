import LegalPage from "@/components/legal/LegalPage"

const REFERENCES = [
  {
    label: "Ley N.º 21.719 sobre protección de datos personales",
    href: "https://www.bcn.cl/leychile/navegar?idNorma=1209272",
    detail: "Marco de protección de datos, seguridad, transparencia, derechos y tratamiento de información de menores desde diciembre de 2026.",
  },
  {
    label: "Ley N.º 21.430 sobre garantías de la niñez y adolescencia",
    href: "https://www.bcn.cl/leychile/navegar?idNorma=1173643",
    detail: "Reconoce la privacidad, la protección de datos y el deber de usar lenguaje comprensible para menores.",
  },
  {
    label: "UNESCO: Recomendación sobre la ética de la inteligencia artificial",
    href: "https://unesdoc.unesco.org/ark:/48223/pf0000381137_spa",
    detail: "Referencia internacional para supervisión humana, proporcionalidad, transparencia, equidad y protección de la niñez.",
  },
]

export default function AiGovernancePage() {
  return (
    <LegalPage
      eyebrow="Uso responsable de inteligencia artificial"
      title="Política de gobernanza de IA"
      summary="Define los principios, responsabilidades y controles para diseñar, integrar y utilizar agentes de inteligencia artificial dentro de EduAI."
      updatedAt="24 de julio de 2026"
      references={REFERENCES}
    >
      <h2>1. Alcance</h2>
      <p>
        Esta política se aplica a los agentes, modelos, proveedores, automatizaciones y funciones de inteligencia artificial utilizadas por EduAI, incluyendo tutoría, planificación, evaluación, generación de imágenes, audio, video, traducción, investigación y asistencia administrativa.
      </p>

      <h2>2. Principios</h2>
      <ul>
        <li><strong>Finalidad educativa:</strong> la IA debe utilizarse para apoyar aprendizaje, docencia, creación, accesibilidad y gestión autorizada.</li>
        <li><strong>Supervisión humana:</strong> las decisiones relevantes deben poder ser revisadas por una persona competente.</li>
        <li><strong>Minimización:</strong> solo se enviarán al modelo los datos necesarios para la tarea.</li>
        <li><strong>Transparencia:</strong> los usuarios deben saber cuándo interactúan con IA y cuáles son sus limitaciones.</li>
        <li><strong>Seguridad y privacidad:</strong> los proveedores y flujos se evaluarán según el riesgo de los datos.</li>
        <li><strong>Equidad e inclusión:</strong> se revisarán sesgos, barreras de accesibilidad y efectos desproporcionados.</li>
        <li><strong>Trazabilidad:</strong> las configuraciones, proveedores y cambios relevantes deben quedar documentados.</li>
      </ul>

      <h2>3. Usos permitidos</h2>
      <ul>
        <li>Explicar contenidos y proponer actividades.</li>
        <li>Apoyar planificación y preparación de materiales.</li>
        <li>Crear borradores, resúmenes, imágenes, audio y otros recursos.</li>
        <li>Entregar retroalimentación formativa.</li>
        <li>Facilitar accesibilidad y adaptaciones autorizadas.</li>
        <li>Analizar métricas agregadas para calidad y seguridad.</li>
      </ul>

      <h2>4. Usos restringidos o prohibidos</h2>
      <ul>
        <li>Tomar medidas disciplinarias exclusivamente mediante IA.</li>
        <li>Emitir diagnósticos médicos, psicológicos o de necesidades educativas como decisión automática.</li>
        <li>Calificar evaluaciones de alto impacto sin revisión o posibilidad de corrección humana.</li>
        <li>Inferir características sensibles no proporcionadas expresamente.</li>
        <li>Entrenar modelos externos con datos identificables de estudiantes sin una base válida y autorización específica.</li>
        <li>Enviar secretos, credenciales, RUT, datos de salud o antecedentes familiares cuando no sean indispensables.</li>
        <li>Usar perfiles automatizados para excluir, discriminar o limitar oportunidades educativas.</li>
      </ul>

      <h2>5. Revisión humana</h2>
      <p>
        Las planificaciones, explicaciones, preguntas, rúbricas y correcciones generadas por IA son propuestas. Docentes y administradores conservan la responsabilidad de verificar exactitud, pertinencia curricular, lenguaje, nivel, accesibilidad y ausencia de sesgos.
      </p>
      <p>
        Todo usuario afectado por una salida incorrecta debe poder reportarla, solicitar revisión y recibir una explicación comprensible sobre la corrección realizada.
      </p>

      <h2>6. Evaluación de proveedores y modelos</h2>
      <p>Antes de habilitar un proveedor se documentará, en la medida aplicable:</p>
      <ul>
        <li>Nombre del proveedor y modelo.</li>
        <li>Finalidad y módulos donde se utiliza.</li>
        <li>Datos que recibe y región de procesamiento.</li>
        <li>Política de retención y uso para entrenamiento.</li>
        <li>Controles de seguridad, moderación y privacidad.</li>
        <li>Alternativa o procedimiento cuando el proveedor no esté disponible.</li>
        <li>Fecha de evaluación, responsable y versión aprobada.</li>
      </ul>

      <h2>7. Datos de estudiantes y menores</h2>
      <p>
        Los datos de menores reciben protección reforzada. Las instrucciones dirigidas a estudiantes deben utilizar lenguaje claro. Los flujos con datos sensibles, PIE, NEE o salud requieren necesidad demostrable, acceso restringido y revisión institucional.
      </p>

      <h2>8. Evaluación, sesgos y calidad</h2>
      <p>
        Los agentes deben someterse a pruebas periódicas de exactitud, seguridad, contenido inapropiado, discriminación, accesibilidad y consistencia. Las pruebas deben considerar asignaturas, niveles, lenguaje chileno, diversidad de estudiantes y escenarios PIE/NEE sin utilizar datos reales innecesarios.
      </p>

      <h2>9. Registro e incidentes de IA</h2>
      <p>
        Se registrarán incidentes relevantes, como exposición de datos, respuestas perjudiciales, errores sistemáticos, fallas de moderación o cambios inesperados del proveedor. El registro debe indicar fecha, módulo, modelo, impacto, contención, corrección y responsable de cierre.
      </p>

      <h2>10. Cambios y control de versiones</h2>
      <p>
        Los cambios importantes de modelo, proveedor, prompt de sistema, permisos o tipo de datos tratados deben quedar documentados y probarse antes de producción. Cuando el riesgo sea alto, el cambio se desplegará mediante una función desactivable o una vista previa antes de su habilitación general.
      </p>

      <h2>11. Responsabilidades</h2>
      <ul>
        <li><strong>Innova Space Edu SpA:</strong> arquitectura, controles, proveedores, documentación y respuesta técnica.</li>
        <li><strong>Establecimiento:</strong> finalidades educativas, usuarios autorizados, instrucciones y decisiones pedagógicas.</li>
        <li><strong>Docentes y administradores:</strong> revisión de resultados y protección de información.</li>
        <li><strong>Usuarios:</strong> uso responsable, verificación de resultados y reporte de fallas.</li>
      </ul>
    </LegalPage>
  )
}
