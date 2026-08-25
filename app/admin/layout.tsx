import AdminTopTools from "@/components/admin/AdminTopTools"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AdminTopTools />
      <style>{`
        a[title="Enviar un reporte de falla al administrador"],
        button[title="Soporte y reportes"] {
          display: none !important;
        }
      `}</style>
    </>
  )
}
