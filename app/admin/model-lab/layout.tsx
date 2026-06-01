import { redirect } from "next/navigation"
import { getModelLabAccess } from "@/lib/auth/model-lab-access"
import ProvidersStatusClient from "./ProvidersStatusClient"
import ImageGeneratorClient from "./ImageGeneratorClient"
import VideoGeneratorClient from "./VideoGeneratorClient"
import JobsHistoryClient from "./JobsHistoryClient"
import OpenRouterModelsClient from "./OpenRouterModelsClient"
import ModelCatalog from "./ModelCatalog"

export default async function ModelLabLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const access = await getModelLabAccess()

  if (access.status === "unauthenticated") redirect("/login")
  if (access.status === "forbidden") redirect("/admin")
  if (access.status === "mfa_required") redirect("/admin/model-lab-mfa")

  return (
    <>
      {children}
      <main className="bg-slate-950 px-4 pb-10 text-white">
        <div className="mx-auto max-w-6xl space-y-6">
          <ProvidersStatusClient />
          <ImageGeneratorClient />
          <VideoGeneratorClient />
          <JobsHistoryClient />
          <OpenRouterModelsClient />
          <ModelCatalog />
        </div>
      </main>
    </>
  )
}
