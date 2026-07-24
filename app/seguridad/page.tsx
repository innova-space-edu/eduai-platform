import LegalPage from "@/components/legal/LegalPage"

const REFERENCES = [
  {
    label: "Ley N.º 21.663 Marco de Ciberseguridad",
    href: "https://www.bcn.cl/leychile/navegar?idNorma=1202434",
    detail: "Marco chileno para prevención, contención, resolución y respuesta a incidentes de ciberseguridad.",
  },
  {
    label: "Ley N.º 21.719 sobre protección de datos personales",
    href: "https://www.bcn.cl/leychile/navegar?idNorma=1209272",
    detail: "Incluye obligaciones reforzadas de seguridad, responsabilidad y gestión de vulneraciones desde diciembre de 2026.",
  },
  {
    label: "OWASP Application Security Verification Standard",
    href: "https://owasp.org/www-project-application-security-verification-standard/",
    detail: "Referencia técnica para verificación de controles de seguridad en aplicaciones web.",
  },
]

export default function SecurityPage() {
  return (
    <LegalPage
      eyebrow="Protección de la plataforma"
      title="Política de seguridad de EduAI"
      summary="Describe los controles y responsabilidades generales utilizados para reducir riesgos, proteger cuentas y responder ante fallas o incidentes."
      updatedAt="24 de julio de 2026"
      references={REFERENCES}
    >
      <h2>1. Objetivo</h2>
      <p>
        EduAI aplica un enfoque de seguridad basado en riesgo para proteger confidencialidad, integridad, disponibilidad y trazabilidad de los datos y servicios. Los controles se ajustan según la sensibilidad de la información, el rol del usuario y el impacto potencial de una falla.
      </p>

      <h2>2. Controles principales</h2>
      <ul>
        <li>Autenticación y sesiones administradas mediante servicios especializados.</li>
        <li>Autorización por roles para estudiantes, docentes y administradores.</li>
        <li>Políticas de acceso a nivel de fila en las tablas expuestas cuando corresponda.</li>
        <li>Separación entre claves públicas y credenciales privilegiadas de servidor.</li>
        <li>Cifrado en tránsito mediante HTTPS.</li>
        <li>Registro de eventos administrativos, errores y actividad relevante.</li>
        <li>Validación de archivos, límites de tamaño y controles de tipo de contenido.</li>
        <li>Respaldo y recuperación según la criticidad del servicio.</li>
        <li>Revisión de dependencias, configuraciones y permisos.</li>
      </ul>

      <h2>3. Responsabilidades de los usuarios</h2>
      <ul>
        <li>Utilizar contraseñas seguras y no compartir cuentas.</li>
        <li>Cerrar sesión en equipos compartidos.</li>
        <li>No cargar información sensible innecesaria.</li>
        <li>No intentar eludir controles, acceder a cuentas ajenas o alterar evaluaciones.</li>
        <li>Reportar inmediatamente accesos sospechosos, pérdida de dispositivos o exposición de datos.</li>
      </ul>

      <h2>4. Administración y privilegios</h2>
      <p>
        Los accesos administrativos se limitan a personal autorizado. Las credenciales privilegiadas no deben incorporarse al cliente, al repositorio, a capturas de pantalla ni a archivos compartidos. Las acciones sensibles deben realizarse desde el servidor y quedar sujetas a verificación de rol.
      </p>

      <h2>5. Gestión de vulnerabilidades</h2>
      <p>
        Las vulnerabilidades deben reportarse de forma privada mediante el procedimiento indicado en el archivo SECURITY.md del repositorio o al canal institucional definido. No deben publicarse detalles explotables en Issues, foros, redes sociales o mensajes grupales antes de que exista una corrección.
      </p>

      <h2>6. Respuesta a incidentes</h2>
      <p>Ante un incidente se aplicará, según su gravedad, el siguiente ciclo:</p>
      <ul>
        <li>Detección, registro y clasificación.</li>
        <li>Contención y protección de evidencias.</li>
        <li>Revocación de sesiones, claves o permisos comprometidos.</li>
        <li>Evaluación de los datos y usuarios afectados.</li>
        <li>Corrección, recuperación y verificación.</li>
        <li>Comunicación y notificación cuando corresponda.</li>
        <li>Análisis de causa raíz y acciones preventivas.</li>
      </ul>

      <h2>7. Datos de menores y datos sensibles</h2>
      <p>
        Los incidentes que involucren menores, calificaciones, respuestas, RUT, antecedentes PIE/NEE o información de salud reciben prioridad alta. El acceso a esos antecedentes debe restringirse y toda comunicación debe evitar divulgar información adicional.
      </p>

      <h2>8. Proveedores</h2>
      <p>
        Los proveedores de nube, base de datos, IA y multimedia deben evaluarse según los datos que procesan, sus controles de acceso, retención, ubicación, respuesta a incidentes y condiciones contractuales. La existencia de un proveedor no reemplaza la responsabilidad de configurar correctamente la plataforma.
      </p>

      <h2>9. Alcance de la Ley Marco de Ciberseguridad</h2>
      <p>
        La Ley N.º 21.663 establece obligaciones para las entidades comprendidas en su ámbito, incluyendo prestadores de servicios esenciales y operadores de importancia vital. La aplicación directa a Innova Space Edu SpA o a un establecimiento específico debe evaluarse jurídicamente según sus actividades y calificación. EduAI adopta sus principios de prevención y respuesta como referencia de buenas prácticas, sin afirmar automáticamente una calificación legal determinada.
      </p>

      <h2>10. Contacto</h2>
      <p>
        Los reportes generales pueden enviarse desde el Centro de soporte de EduAI. Los reportes de vulnerabilidad que incluyan detalles técnicos deben enviarse de forma privada a <strong>contacto@innova-space-edu.cl</strong>, con el asunto <strong>SEGURIDAD EDUAI</strong>.
      </p>
    </LegalPage>
  )
}
