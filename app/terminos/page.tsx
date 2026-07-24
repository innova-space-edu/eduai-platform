import LegalPage from "@/components/legal/LegalPage"

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Condiciones de utilización"
      title="Términos de uso de EduAI"
      summary="Establecen las reglas generales para acceder a la plataforma, utilizar sus agentes y gestionar contenidos educativos."
      updatedAt="24 de julio de 2026"
    >
      <h2>1. Aceptación y alcance</h2>
      <p>
        Al utilizar EduAI, el usuario acepta estas condiciones y las políticas de privacidad, seguridad y gobernanza de IA. Cuando el acceso sea proporcionado por un establecimiento, también se aplicarán sus reglamentos, instrucciones y acuerdos institucionales.
      </p>

      <h2>2. Uso educativo autorizado</h2>
      <p>
        EduAI debe utilizarse con fines educativos, creativos, administrativos o de investigación autorizados. El usuario es responsable de revisar la exactitud y pertinencia de los materiales generados antes de utilizarlos en evaluaciones, comunicaciones oficiales o decisiones relevantes.
      </p>

      <h2>3. Cuentas</h2>
      <ul>
        <li>Cada usuario debe utilizar su propia cuenta.</li>
        <li>No se permite compartir contraseñas ni suplantar a otra persona.</li>
        <li>Los administradores pueden suspender accesos cuando exista riesgo, abuso o incumplimiento.</li>
        <li>Los datos de registro deben mantenerse razonablemente actualizados.</li>
      </ul>

      <h2>4. Conductas prohibidas</h2>
      <ul>
        <li>Intentar acceder a información de otros usuarios sin autorización.</li>
        <li>Alterar notas, respuestas, tiempos, registros o controles de examen.</li>
        <li>Cargar malware, contenido ilícito o archivos destinados a afectar el servicio.</li>
        <li>Extraer masivamente información o automatizar accesos sin autorización.</li>
        <li>Utilizar la plataforma para hostigar, discriminar, engañar o vulnerar derechos.</li>
        <li>Compartir secretos, credenciales o datos sensibles innecesarios.</li>
      </ul>

      <h2>5. Contenido e inteligencia artificial</h2>
      <p>
        Las salidas generadas por IA pueden ser incompletas o incorrectas. El usuario debe verificar hechos, fórmulas, referencias, lenguaje y adecuación pedagógica. EduAI no reemplaza el criterio profesional docente, la evaluación clínica, la asesoría jurídica ni otros servicios especializados.
      </p>

      <h2>6. Propiedad y licencias</h2>
      <p>
        El usuario conserva los derechos que posea sobre el contenido que aporta. Debe contar con autorización para cargar archivos de terceros. El software, marcas, interfaces y componentes propios de EduAI pertenecen a sus respectivos titulares y no pueden copiarse o redistribuirse fuera de las licencias aplicables.
      </p>

      <h2>7. Evaluaciones</h2>
      <p>
        Los exámenes, temporizadores, bloqueos y correcciones automáticas son herramientas de apoyo. El establecimiento y el docente son responsables de definir condiciones, supervisar la aplicación, atender incidencias y validar los resultados antes de utilizarlos oficialmente.
      </p>

      <h2>8. Disponibilidad y cambios</h2>
      <p>
        La plataforma puede experimentar mantenimiento, límites de proveedores o interrupciones. Las funciones podrán cambiar para mejorar seguridad, cumplimiento o calidad. Los cambios relevantes se comunicarán por medios adecuados.
      </p>

      <h2>9. Suspensión y eliminación</h2>
      <p>
        Se podrá restringir temporalmente una cuenta para contener un incidente, proteger a otros usuarios o investigar un uso indebido. La eliminación de datos y cuentas se realizará conforme a la política de privacidad, los acuerdos institucionales y las obligaciones aplicables.
      </p>

      <h2>10. Contacto</h2>
      <p>
        Consultas generales, solicitudes y reportes pueden enviarse mediante el Centro de soporte o al correo <strong>contacto@innova-space-edu.cl</strong>.
      </p>
    </LegalPage>
  )
}
