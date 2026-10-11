export default function FamilyAuthorizationPending() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-900">
      <div className="max-w-xl space-y-4 rounded-3xl border bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Protección de estudiantes</p>
        <h1 className="text-2xl font-bold">Autorización familiar pendiente</h1>
        <p className="text-sm leading-6 text-slate-700">
          La cuenta todavía requiere validación institucional del consentimiento familiar,
          cuando corresponda. La firma electrónica y la entrega del cuestionario no acreditan
          automáticamente la identidad ni la facultad legal de quien lo respondió.
        </p>
        <p className="text-sm leading-6 text-slate-700">
          Solicita al establecimiento una invitación al formulario; puede enviarse por correo
          electrónico o WhatsApp autorizado. Si ya fue firmada, la institución debe
          validar los antecedentes y registrar la aprobación.
        </p>
        <p className="text-xs text-slate-600">
          Las actividades cuya base jurídica no requiera autorización familiar deben evaluarse
          separadamente por la institución. Los permisos opcionales rechazados no se activarán.
        </p>
        <a href="mailto:contacto@innova-space-edu.cl?subject=Autorizacion%20familiar%20pendiente"
          className="inline-flex rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white">
          Contactar soporte de Innova
        </a>
      </div>
    </main>
  )
}
