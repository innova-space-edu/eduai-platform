import "./apply-student-rut-consent.mjs"
import "./fix-student-rut-consent.mjs"
import fs from "node:fs"

const checks = [
  {
    path: "app/admin/exam-access/page.tsx",
    required: [
      `setLoading(true)\n        const supabase = createClient()\n        const { data } = await supabase.auth.getSession()`,
    ],
    forbidden: [
      `export default function ExamAccessPage() {\n  const supabase = createClient()`,
    ],
  },
  {
    path: "app/creator-hub/layout.tsx",
    required: [
      `useEffect(() => {\n    const supabase = createClient()\n    supabase.auth.getUser()`,
      `}, [router])`,
    ],
    forbidden: [
      `const supabase = useMemo(() => createClient(), [])`,
      `}, [router, supabase])`,
    ],
  },
  {
    path: "app/audio-lab-large/page.tsx",
    required: [
      `setStage("uploading")\n      const supabase = createClient()\n      await uploadAudioResumable({`,
    ],
    forbidden: [
      `const supabase = useMemo(() => createClient(), [])`,
    ],
  },
]

for (const check of checks) {
  const source = fs.readFileSync(check.path, "utf8")
  for (const needle of check.required) {
    if (!source.includes(needle)) {
      throw new Error(`[test-client-supabase-prerender] Falta patrón seguro en ${check.path}: ${needle}`)
    }
  }
  for (const needle of check.forbidden) {
    if (source.includes(needle)) {
      throw new Error(`[test-client-supabase-prerender] Inicialización durante render todavía presente en ${check.path}: ${needle}`)
    }
  }
}

console.log("[test-client-supabase-prerender] rutas browser no crean Supabase durante prerender")
