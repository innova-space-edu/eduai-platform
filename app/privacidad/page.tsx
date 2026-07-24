import LegalPage from "@/components/legal/LegalPage"

const REFERENCES = [
  {
    label: "Ley N.º 19.628 sobre protección de la vida privada",
    href: "https://www.bcn.cl/leychile/navegar?idNorma=141599",
    detail: "Texto vigente hasta el 30 de noviembre de 2026 y texto diferido de la reforma.",
  },
  {
    label: "Ley N.º 21.719 sobre protección y tratamiento de datos personales",
    href: "https://www.bcn.cl/leychile/navegar?idNorma=1209272",
    detail: "Reforma publicada el 13 de diciembre de 2024, con entrada en vigor general el 1 de diciembre de 2026.",
  },
  {
    label: "Ley N.º 21.430 sobre garantías de la niñez y adolescencia",
    href: "https://www.bcn.cl/leychile/navegar?idNorma=1173643",
    detail: "Su artículo 33 reconoce el derecho de niños, niñas y adolescentes a la vida privada y a la protección de sus datos personales.",
  },
]

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacidad y datos personales"
      title="Política de privacidad de EduAI"
      summary="Esta política explica qué información puede tratar EduAI, para qué se utiliza, cómo se protege y qué derechos poseen estudiantes, docentes, apoderados y demás titulares de datos."
      updatedAt="24 de julio de 2026"
      references={REFERENCES}
    >
      <h2>1. Responsable y contexto del tratamiento</h2>
      <p>
        <strong>EduAI Platform</strong> es una plataforma desarrollada y administrada por <strong>Innova Space Edu SpA</strong>. El correo de contacto institucional es <strong>contacto@innova-space-edu.cl</strong>.
      </p>
      <p>
        Según la forma de contratación y uso, Innova Space Edu SpA puede actuar como responsable del tratamiento o como proveedor encargado que procesa información siguiendo instrucciones de un establecimiento educacional. El contrato, convenio o anexo de tratamiento debe identificar claramente las funciones y responsabilidades de cada parte.
      </p>

      <h2>2. Información que puede tratar la plataforma</h2>
      <ul>
        <li>Datos de identificación y contacto, como nombre, correo, identificador de cuenta y, cuando corresponda, RUT.</li>
        <li>Datos académicos, como curso, asignatura, evaluaciones, calificaciones, respuestas, retroalimentación y avance.</li>
        <li>Datos de actividad, como accesos, rutas utilizadas, acciones, fecha, hora, errores y métricas técnicas.</li>
        <li>Contenido aportado por el usuario, como textos, archivos, imágenes, audio, instrucciones y documentos.</li>
        <li>Información administrativa y de soporte, incluyendo reportes de fallas y respuestas del administrador.</li>
        <li>Datos sensibles únicamente cuando una función autorizada lo requiera, por ejemplo información PIE, NEE, discapacidad, salud o apoyos educativos.</li>
      </ul>
      <p>
        La plataforma no debe solicitar datos sensibles que no sean necesarios para la finalidad educativa definida. Los usuarios deben evitar incluir RUT, diagnósticos, antecedentes de salud o información familiar dentro de prompts, archivos o mensajes cuando esa información no sea indispensable.
      </p>

      <h2>3. Finalidades</h2>
      <ul>
        <li>Crear y administrar cuentas y perfiles.</li>
        <li>Entregar tutoría, planificación, creación de recursos, evaluación, colaboración y otras funciones educativas.</li>
        <li>Guardar trabajos, resultados y configuraciones solicitadas por el usuario.</li>
        <li>Aplicar adaptaciones educativas autorizadas y apoyos de accesibilidad.</li>
        <li>Prevenir fraude, abuso, accesos no autorizados y fallas operacionales.</li>
        <li>Atender reportes de soporte e incidentes de seguridad.</li>
        <li>Obtener estadísticas internas, preferentemente agregadas o anonimizadas, para mejorar calidad, capacidad y seguridad.</li>
        <li>Cumplir obligaciones contractuales, educacionales y legales.</li>
      </ul>

      <h2>4. Datos de niños, niñas y adolescentes</h2>
      <p>
        El tratamiento de información de menores debe respetar su interés superior, su autonomía progresiva y su derecho a recibir información comprensible. Los establecimientos, apoderados y responsables de la plataforma deben limitar el tratamiento a lo necesario para la finalidad educativa.
      </p>
      <p>
        La Ley N.º 21.719 entrará en vigor de forma general el 1 de diciembre de 2026 y establece reglas expresas para datos de niños, niñas y adolescentes, además de una obligación especial para establecimientos educacionales y entidades que administren dicha información. La plataforma debe preparar desde ahora sus procesos, contratos, inventarios y controles para ese estándar reforzado.
      </p>

      <h2>5. Inteligencia artificial y proveedores</h2>
      <p>
        Algunas herramientas pueden enviar instrucciones o fragmentos necesarios a proveedores tecnológicos o modelos de inteligencia artificial. Antes de habilitar un proveedor, se deben evaluar sus condiciones, ubicación del procesamiento, retención, seguridad y uso de datos para entrenamiento.
      </p>
      <p>
        EduAI no debe utilizar notas, respuestas, datos sensibles o información identificable de menores para entrenar modelos externos salvo que exista una autorización válida, una finalidad informada y resguardos contractuales específicos. Siempre que sea posible, la información debe minimizarse, anonimizarse o seudonimizarse antes de enviarse a un servicio externo.
      </p>

      <h2>6. Decisiones y revisión humana</h2>
      <p>
        Las respuestas de IA pueden contener errores. Las calificaciones, decisiones pedagógicas relevantes, medidas disciplinarias, diagnósticos o determinaciones que produzcan efectos importantes no deben adoptarse exclusivamente sobre la base de una salida automatizada. Debe existir revisión humana y un mecanismo para solicitar corrección.
      </p>

      <h2>7. Conservación y eliminación</h2>
      <p>
        La información se conservará durante el tiempo necesario para prestar el servicio, cumplir la finalidad informada y atender obligaciones contractuales o legales. Los plazos específicos deben quedar definidos por categoría de datos en el registro interno de tratamiento y en los acuerdos con cada institución.
      </p>
      <p>
        Al finalizar la relación, los datos deben eliminarse, devolverse o anonimizarse según corresponda, considerando respaldos, auditoría, reclamaciones pendientes y obligaciones legales. No se debe conservar información indefinidamente por defecto.
      </p>

      <h2>8. Seguridad</h2>
      <p>
        EduAI aplica controles de autenticación, autorización por roles, políticas de acceso a datos, cifrado en tránsito, registros de actividad, separación de secretos, copias de respaldo y procedimientos de respuesta a incidentes. Ningún sistema es completamente infalible, por lo que los controles se revisan según el riesgo y la evolución de la plataforma.
      </p>

      <h2>9. Derechos de los titulares</h2>
      <p>
        Los titulares pueden solicitar información sobre sus datos y, según la legislación aplicable, pedir acceso, rectificación, eliminación o bloqueo. Desde la entrada en vigor de la Ley N.º 21.719 se incorporan además derechos reforzados, incluyendo oposición y portabilidad en los casos previstos por la ley.
      </p>
      <p>
        Las solicitudes se pueden enviar a <strong>contacto@innova-space-edu.cl</strong>. La plataforma podrá pedir antecedentes razonables para verificar identidad y evitar que terceros accedan a información ajena. Para menores, la solicitud puede requerir la intervención del representante correspondiente, sin desconocer la autonomía progresiva del estudiante.
      </p>

      <h2>10. Reportes anonimizados</h2>
      <p>
        Los reportes destinados a análisis general deben excluir nombre, correo, RUT, identificadores técnicos directos, contenido de respuestas y datos sensibles. Cuando se requiera seguimiento interno, se utilizarán códigos seudonimizados y acceso restringido. La anonimización debe evaluarse considerando el riesgo de reidentificación mediante curso, fechas, grupos pequeños u otras combinaciones.
      </p>

      <h2>11. Cambios a esta política</h2>
      <p>
        Esta política puede actualizarse por cambios funcionales, contractuales o normativos. La fecha de actualización se indicará en la parte superior y los cambios relevantes deberán comunicarse por medios adecuados.
      </p>
    </LegalPage>
  )
}
