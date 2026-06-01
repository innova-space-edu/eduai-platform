import { redirect } from "next/navigation"
import { getModelLabAccess } from "@/lib/auth/model-lab-access"

export default async function ModelLabLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const access = await getModelLabAccess()

  if (access.status === "unauthenticated") redirect("/login")
  if (access.status === "forbidden") redirect("/admin")
  if (access.status === "mfa_required") redirect("/admin/model-lab-mfa")

  return children
}
