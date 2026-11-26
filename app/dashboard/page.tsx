"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import ClawStudyConsole from "@/components/dashboard/ClawStudyConsole"
import {
  BookOpen,
  Bot,
  FolderKanban,
  LibraryBig,
  GraduationCap,
  LogOut,
  MessageCircle,
  MessageSquareWarning,
  Music2,
  QrCode,
  ShieldCheck,
  UserCircle2,
  Users,
  Zap,
} from "lucide-react"

const NAV_LINKS = [
  { href: "/agentes", icon: Bot, label: "Agentes", color: "#2563eb" },
  { href: "/sessions", icon: BookOpen, label: "Sesiones", color: "#7c3aed" },
  { href: "/chat", icon: MessageCircle, label: "Chat", color: "#059669" },
  { href: "/music", icon: Music2, label: "Música", color: "#10b981" },
  { href: "/collab", icon: Users, label: "Colaborar", color: "#0d9488" },
  { href: "/workspace", icon: FolderKanban, label: "Workspace", color: "#4338ca" },
  { href: "/qr-studio", icon: QrCode, label: "QR Studio", color: "#0891b2" },
  { href: "/profile", icon: UserCircle2, label: "Perfil", color: "#64748b" },
]

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [expanded, setExpanded] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [canManageTeaching, setCanManageTeaching] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/login")
        return
      }

      setUser(user)

      const { data: adminData } = await supabase
        .from("admin_emails")
        .select("email")
        .eq("email", user.email)
        .maybeSingle()
      setIsAdmin(Boolean(adminData))
      const { data: access, error: accessError } = await supabase
        .from("eduai_user_access")
        .select("account_type,age_band,access_tier")
        .eq("user_id", user.id)
        .maybeSingle()
      setCanManageTeaching(!accessError && access?.account_type === "teacher" && access?.age_band === "adult" && ["standard", "teacher", "admin"].includes(access?.access_tier || ""))

    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const displayName = user?.user_metadata?.name || user?.email?.split("@")[0] || "Usuario"

  return (
    <div className="flex h-[calc(100dvh-var(--legacy-consent-banner-height,0px))] min-h-0 overflow-hidden bg-app [--sidebar-closed:56px] [--sidebar-open:184px] lg:[--sidebar-closed:68px] lg:[--sidebar-open:220px] min-[2048px]:[--sidebar-closed:84px] min-[2048px]:[--sidebar-open:280px]">
      <style data-eduai-dashboard-refresh>{`
/* Scoped to the dashboard; existing theme tokens remain the source of text/surface contrast. */
div:has(> style[data-eduai-dashboard-refresh]) {
  --claw-lavender: rgba(139,92,246,.12);
  --claw-blue: rgba(96,165,250,.10);
  --claw-mint: rgba(45,212,191,.09);
  background-image: radial-gradient(ellipse at 7% 3%, var(--claw-lavender), transparent 43%), radial-gradient(ellipse at 98% 95%, var(--claw-blue), transparent 52%);
}
div:has(> style[data-eduai-dashboard-refresh]) aside > div:first-child {
  background-image: linear-gradient(165deg, var(--claw-lavender), transparent 45%, var(--claw-blue)) !important;
}
div:has(> style[data-eduai-dashboard-refresh]) aside nav a > div:first-child,
div:has(> style[data-eduai-dashboard-refresh]) aside button > div:first-child {
  border-radius: 14px;
  box-shadow: 0 3px 10px rgba(76,58,145,.08);
}
div:has(> style[data-eduai-dashboard-refresh]) .eduai-dashboard-topbar {
  background-image: linear-gradient(100deg, var(--claw-lavender), transparent 45%, var(--claw-blue)) !important;
}
div:has(> style[data-eduai-dashboard-refresh]) .eduai-dashboard-topbar a {
  border-radius: 999px;
  flex-shrink: 0;
  box-shadow: 0 2px 7px rgba(79,70,229,.07);
}
div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh {
  background: color-mix(in srgb, var(--bg-card) 84%, transparent);
  border-color: color-mix(in srgb, #a78bfa 22%, var(--border-soft));
  box-shadow: 0 8px 32px rgba(85,65,155,.09);
}
div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-header {
  align-items: center;
  background-image: radial-gradient(ellipse at 94% 100%, var(--claw-mint), transparent 48%), linear-gradient(110deg, var(--claw-lavender), var(--claw-blue), transparent);
}
div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-transcript {
  background: radial-gradient(ellipse at 2% 2%, var(--claw-lavender), transparent 55%), radial-gradient(ellipse at 100% 100%, var(--claw-blue), transparent 55%);
}
div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-context {
  background: color-mix(in srgb, var(--bg-card) 85%, #a78bfa 15%);
  border-color: rgba(139,92,246,.20);
  color: var(--text-primary);
}
div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-start {
  background: linear-gradient(125deg, var(--claw-lavender), var(--claw-blue) 56%, var(--claw-mint)), var(--bg-card);
  border-color: rgba(139,92,246,.19);
  box-shadow: 0 6px 22px rgba(85,65,155,.07);
}
div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-welcome {
  background: radial-gradient(ellipse at 100% 50%, rgba(45,212,191,.17), transparent 52%), linear-gradient(120deg, rgba(167,139,250,.17), rgba(96,165,250,.10)), var(--bg-card);
  border-color: rgba(139,92,246,.15);
}
div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-action {
  min-height: 60px;
  box-shadow: 0 4px 14px rgba(79,70,229,.06);
}
div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-action:hover,
div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-shortcut:hover {
  border-color: #a78bfa !important;
  box-shadow: 0 5px 18px rgba(124,58,237,.15);
}
div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-assistant {
  background: linear-gradient(135deg, var(--claw-blue), transparent 60%, var(--claw-lavender)), var(--bg-card);
  border-color: rgba(139,92,246,.15);
  box-shadow: 0 4px 14px rgba(85,65,155,.07);
  overflow-wrap: anywhere;
}
div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-user,
div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-send {
  background: linear-gradient(120deg,#4f46e5,#7c3aed);
  box-shadow: 0 3px 12px rgba(99,70,210,.20);
}
div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-footer {
  background: color-mix(in srgb, var(--bg-card) 90%, transparent);
}
div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-composer {
  background: linear-gradient(120deg, var(--claw-lavender), transparent 45%, var(--claw-blue)), var(--bg-card);
  border-color: rgba(139,92,246,.30);
  box-shadow: 0 0 0 3px rgba(139,92,246,.07), 0 6px 20px rgba(85,65,155,.09);
}
div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-composer:focus-within {
  border-color: #8b5cf6;
  box-shadow: 0 0 0 3px rgba(139,92,246,.17);
}
div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-send:hover:not(:disabled) { background: linear-gradient(120deg,#4338ca,#6d28d9); }
div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-send:disabled { opacity: .5; }
div:has(> style[data-eduai-dashboard-refresh]) :is(a,button):focus-visible { outline: 2px solid #8b5cf6; outline-offset: 2px; }
.dark div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-action > div:first-child { color: #e0e7ff !important; }
@media (min-width: 1280px) {
  div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-transcript > div,
  div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-composer { max-width: 1120px; }
}
@media (min-width: 2048px) {
  div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-transcript > div,
  div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-composer { max-width: 1450px; }
}
@media (prefers-reduced-motion: reduce) {
  div:has(> style[data-eduai-dashboard-refresh]) aside, div:has(> style[data-eduai-dashboard-refresh]) main,
  div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-action,
  div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-action > div { transition: none; }
}

/* Pastel mascot workspace — light theme; retain the existing dark-theme tokens. */
.claw-hero-bird,.claw-welcome-art,.claw-sparkle,.claw-action-arrow { display:none; }
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) {
  --claw-lavender:rgba(179,134,248,.22); --claw-blue:rgba(118,189,249,.22); --claw-mint:rgba(92,221,200,.24);
  background-color:#f7f7fc;
  background-image:radial-gradient(ellipse at 5% 5%,#eadcfb,transparent 52%),radial-gradient(ellipse at 94% 90%,#dcecff,transparent 55%),radial-gradient(ellipse at 15% 100%,#d6f4f5,transparent 45%);
}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh {border:0;background:transparent;box-shadow:none;gap:12px;overflow:visible;}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-header {
  position:relative;isolation:isolate;border:1px solid #ffffffde;border-radius:28px;
  background:radial-gradient(ellipse at 80% 130%,#8ee9df 0%,transparent 55%),radial-gradient(ellipse at 0% 130%,#c69af5 0%,transparent 40%),linear-gradient(110deg,#ead1fa,#c2c8f8 45%,#a7def5 76%,#b5f1e7);
  box-shadow:0 5px 20px #9c84d41a;overflow:hidden;
}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-header::before {content:"";position:absolute;z-index:-1;inset:45% -10% -80% -8%;border-radius:50%;background:#ffffff3d;transform:rotate(-7deg);}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-header h1 {font-weight:900;color:#111629;letter-spacing:-.035em;}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-header p {color:#39445c;}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-header > span {position:relative;z-index:1;box-shadow:0 3px 12px #169e7d23;}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-transcript {border:1px solid #ffffffee;border-radius:28px 28px 0 0;background:linear-gradient(135deg,#f8f2ffb0,#f7faffba 52%,#e8f9f6b0);position:relative;}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-transcript[data-claw-empty="true"] {background:radial-gradient(ellipse at 5% 15%,#e8dcfa99,transparent 62%),radial-gradient(ellipse at 98% 65%,#d4f5f5bb,transparent 55%),linear-gradient(135deg,#f6f0ff,#f7fbff 60%,#fff2f7);}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-start {border:0;background:transparent;box-shadow:none;padding:12px;}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-start h2 {font-size:clamp(18px,1.65vw,30px);font-weight:850;letter-spacing:-.035em;color:#111629;}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-start h2 + p {font-size:clamp(11px,1vw,15px);color:#46516c;}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-sparkle {display:grid;place-items:center;width:46px;height:46px;flex:none;border-radius:50%;color:#8244eb;background:linear-gradient(135deg,#f3e6ff,#e7d7ff);box-shadow:inset 0 0 8px #ffffffb0;}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-action {min-height:96px;border:2px solid #ffffffdd!important;border-radius:24px;box-shadow:0 5px 12px #7f82c223,inset 0 0 12px #ffffff70;padding:12px;gap:12px;}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-action > div:first-child {width:48px;height:48px;border-radius:50%;}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-action > div:first-child svg {width:23px;height:23px;}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-action p:first-child {font-size:clamp(13px,1.15vw,19px);font-weight:800;color:#172033;}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-action p + p {font-size:clamp(11px,.93vw,14px);color:#34445b;}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-action-arrow {display:grid;place-items:center;margin-left:auto;flex:none;width:30px;height:30px;border-radius:50%;background:#ffffff88;color:#26344e;}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-shortcut {background:#ffffffcf;box-shadow:0 3px 9px #9183c01f;border-color:#e5ddfa;padding:7px 12px;}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-footer {margin-top:-12px;border:1px solid #ffffffee;border-top:0;border-radius:0 0 28px 28px;background:linear-gradient(100deg,#f5edfc,#f8fcff,#e5f7ff);padding-bottom:20px;}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-composer {border:2px solid transparent;background:linear-gradient(120deg,#f8f2ff,#fcfcfe 48%,#e7f6ff) padding-box,linear-gradient(110deg,#d8a2fc,#c1c9f9 48%,#62d5ee) border-box;box-shadow:0 0 0 5px #ffffff8a,0 5px 25px #a78bfa40;border-radius:28px;padding:12px;}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-send {background:linear-gradient(120deg,#a78bfa,#7939ea);box-shadow:0 4px 12px #8b5cf633;}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-welcome-art {display:none;}
@media(min-width: 1024px) {
  html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-header {min-height:112px;padding:18px 34px;}
  html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-header h1 {font-size:clamp(21px,2vw,34px);}
  html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-header > div:first-child {position:relative;z-index:1;max-width:65%;}
  html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-header > div:first-child > div:first-child {width:58px;height:58px;border-radius:50%;}
  html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-hero-bird {display:block;position:absolute;right:12%;bottom:-9px;width:clamp(115px,17vw,250px);height:113%;object-fit:contain;pointer-events:none;}
  html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-transcript > div,html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-composer {max-width:1380px;}
  html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-start {padding:10px 18px;}
  html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-welcome-art {display:block;position:relative;height:clamp(100px,25vh,260px);margin:8px auto 0;isolation:isolate;overflow:hidden;}
  html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-welcome-art::before,html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-welcome-art::after {content:"";position:absolute;z-index:-1;left:-12%;right:-12%;height:76%;bottom:-49%;border-radius:50% 50% 0 0;background:linear-gradient(100deg,#ebcffa,#d8d5fd,#dcf1ff,#fbe2e3);transform:rotate(-4deg);}
  html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-welcome-art::after {bottom:-59%;transform:rotate(5deg);opacity:.65;}
  html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-welcome-art > img:first-child {width:100%;height:100%;object-fit:contain;}
  html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-art-bird {position:absolute;left:55%;bottom:4%;width:18%;height:67%;object-fit:contain;filter:drop-shadow(0 5px 5px #7767a533);}
}
@media(max-width: 640px) {
  html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh {gap:7px;}
  html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-header {border-radius:18px;}
  html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-transcript {border-radius:18px 18px 0 0;}
  html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-footer {margin-top:-7px;border-radius:0 0 18px 18px;padding:8px;}
  html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-composer {border-radius:18px;padding:5px;}
  html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-action {min-height:76px;padding:8px;}
  html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-sparkle {width:34px;height:34px;}
  html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-action-arrow {display:none;}
}

/* Match approved proportions; overrides are scoped to this dashboard and light theme. */
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-header {background:linear-gradient(108deg,#ead1fc 0%,#c4c5f8 42%,#a3dff6 70%,#a9f0e4 100%); min-height:104px;}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-header::before {inset:auto -6% -58% -6%;height:120%;transform:rotate(-4deg);background:linear-gradient(110deg,#c59af44d,#72c2f44d,#69dccc60);}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-header::after {content:"";position:absolute;inset:auto -12% -70% -10%;height:120%;border-radius:50%;transform:rotate(5deg);background:linear-gradient(100deg,#f4dcff77,#d1edff77,#d3fff477);z-index:-1;pointer-events:none;}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-header h1 {font-weight:800;}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-header p {font-size:clamp(12px,.95vw,16px);}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-transcript[data-claw-empty="true"] {background:radial-gradient(ellipse at 4% 90%,#efdcfa,transparent 54%),radial-gradient(ellipse at 95% 22%,#def7f4,transparent 55%),linear-gradient(135deg,#f5f0fd,#f8fbff 60%,#f7eefe);}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-transcript[data-claw-empty="true"] > div {min-height:100%;display:flex;flex-direction:column;}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-start {flex:1;display:flex;flex-direction:column;background:transparent;border:0;box-shadow:none;}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-start h2 {font-weight:760;}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-action {position:relative;isolation:isolate;overflow:hidden;min-height:105px;box-shadow:0 7px 16px #8270c82b,inset 0 0 16px #ffffff9c;}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-action::after {content:"";position:absolute;z-index:-1;left:30%;right:-15%;bottom:-55%;height:75%;border-radius:50%;background:currentColor;opacity:.05;transform:rotate(-12deg);pointer-events:none;}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-action p:first-child {font-weight:740;}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-footer {background:linear-gradient(110deg,#f5eefe,#f9fbff 48%,#e9f7fd);border-top:0;}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-composer {background:linear-gradient(110deg,#f6eeff,#fcfcff 48%,#e6f8ff) padding-box,linear-gradient(100deg,#d19cf9,#d6c5ff 44%,#5fd3ee) border-box;box-shadow:0 0 0 5px #ffffff99,0 0 22px #b18bf33d,0 6px 20px #a3c9ef32;}
html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-composer:focus-within {border-color:transparent;box-shadow:0 0 0 4px #ffffffb0,0 0 25px #8c8cf45e;}
@media(min-width:1024px){
 html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-transcript > div,html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-composer {max-width: none;width:96%;}
 html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-start {padding:10px 12px 0;}
 html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-welcome-art {flex:1;min-height:120px;max-height:320px;width:100%;margin:12px auto 0;overflow:visible;}
 html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-welcome-art::before,html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-welcome-art::after {inset:auto 0 0;height:56%;transform:none;border-radius:0;background:linear-gradient(105deg,#e9d5fa99,#d9defa88,#d8f3fb99,#fae3eb88);clip-path:polygon(0 60%,9% 33%,17% 26%,26% 42%,36% 64%,47% 48%,58% 20%,68% 30%,79% 53%,90% 20%,100% 0,100% 100%,0 100%);}
 html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-welcome-art::after {height:42%;opacity:.7;transform:scaleX(-1);}
 html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-welcome-art > img:first-child {max-height:100%;display:block;}
 html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-hero-bird {right:14%;height:108%;width:clamp(150px,19vw,300px);bottom:-4px;}
}
@media(max-width:1023px){html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-header {min-height:0;} html:not(.dark) div:has(> style[data-eduai-dashboard-refresh]) .claw-refresh-action {min-height:76px;}}
`}</style>
      <aside
        style={{ width: expanded ? "var(--sidebar-open)" : "var(--sidebar-closed)" }}
        className="fixed left-0 top-[var(--legacy-consent-banner-height,0px)] z-20 flex h-[calc(100dvh-var(--legacy-consent-banner-height,0px))] min-h-0 flex-col overflow-hidden transition-[width] duration-300"
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={(event) => { if (!event.currentTarget.contains(document.activeElement)) setExpanded(false) }}
        onFocusCapture={() => setExpanded(true)}
        onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setExpanded(false) }}
        aria-label="Navegación EduAI"
      >
        <div
          className="absolute inset-0 border-r backdrop-blur-xl"
          style={{
            background: "var(--bg-sidebar)",
            borderColor: "var(--border-soft)",
            boxShadow: "var(--shadow-sm)",
          }}
        />

        <div className="relative flex h-full flex-col">
          <div className="flex h-12 flex-shrink-0 items-center gap-2 border-b px-2.5 lg:h-14 lg:gap-3 lg:px-4 min-[2048px]:h-16 min-[2048px]:px-5" style={{ borderColor: "var(--border-soft)" }}>
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20 lg:h-9 lg:w-9 lg:rounded-2xl min-[2048px]:h-11 min-[2048px]:w-11">
              <Zap size={18} className="text-main min-[2048px]:h-5 min-[2048px]:w-5" />
            </div>
            {expanded && (
              <span className="animate-fade-in whitespace-nowrap text-sm font-bold text-main lg:text-base min-[2048px]:text-lg">
                Edu<span className="text-blue-600">AI</span>
              </span>
            )}
          </div>

          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-1.5 py-2 lg:px-2 lg:py-3 min-[2048px]:gap-1 min-[2048px]:px-3 min-[2048px]:py-4">
            {(canManageTeaching ? [...NAV_LINKS, { href: "https://gestion-docente.innova-space-edu.cl", icon: GraduationCap, label: "Gestión docente", color: "#4f46e5" }] : NAV_LINKS).map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  title={!expanded ? item.label : undefined}
                  className="group flex items-center gap-2 rounded-xl border border-transparent px-1.5 py-2 transition-all lg:gap-3 lg:rounded-2xl lg:px-2.5 lg:py-2.5 min-[2048px]:py-3"
                  onMouseEnter={(event) => (event.currentTarget.style.background = `${item.color}0d`)}
                  onMouseLeave={(event) => (event.currentTarget.style.background = "")}
                >
                  <div
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-all group-hover:scale-105 lg:h-9 lg:w-9 lg:rounded-xl min-[2048px]:h-11 min-[2048px]:w-11"
                    style={{ background: `${item.color}15`, border: `1px solid ${item.color}28` }}
                  >
                    <Icon size={17} style={{ color: item.color }} />
                  </div>
                  {expanded && (
                    <span className="whitespace-nowrap text-xs font-medium text-sub transition-colors group-hover:text-main lg:text-sm min-[2048px]:text-[15px]">
                      {item.label}
                    </span>
                  )}
                </Link>
              )
            })}

            {isAdmin && (
              <Link
                href="/admin"
                aria-label="Administración"
                title={!expanded ? "Administración" : undefined}
                className="group mt-1 flex items-center gap-2 rounded-xl border border-transparent px-1.5 py-2 transition-all lg:gap-3 lg:rounded-2xl lg:px-2.5 lg:py-2.5 min-[2048px]:py-3"
                onMouseEnter={(event) => (event.currentTarget.style.background = "rgba(124,58,237,0.07)")}
                onMouseLeave={(event) => (event.currentTarget.style.background = "")}
              >
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-all group-hover:scale-105 lg:h-9 lg:w-9 lg:rounded-xl min-[2048px]:h-11 min-[2048px]:w-11"
                  style={{
                    background: "rgba(124,58,237,0.12)",
                    border: "1px solid rgba(124,58,237,0.25)",
                  }}
                >
                  <ShieldCheck size={17} style={{ color: "#7c3aed" }} />
                </div>
                {expanded && (
                  <span className="whitespace-nowrap text-xs font-medium text-purple-600 transition-colors group-hover:text-purple-700 lg:text-sm min-[2048px]:text-[15px]">
                    Administración
                  </span>
                )}
              </Link>
            )}
          </nav>

          <div className="flex-shrink-0 border-t px-1.5 py-2 lg:px-2 lg:py-3 min-[2048px]:px-3" style={{ borderColor: "var(--border-soft)" }}>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                router.push("/login")
              }}
              className="group flex w-full items-center gap-2 rounded-xl border border-transparent px-1.5 py-2 transition-all hover:border-red-100 hover:bg-red-50 lg:gap-3 lg:rounded-2xl lg:px-2.5 lg:py-2.5 min-[2048px]:py-3"
              aria-label="Cerrar sesión"
              title={!expanded ? "Salir" : undefined}
            >
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg lg:h-9 lg:w-9 lg:rounded-xl min-[2048px]:h-11 min-[2048px]:w-11"
                style={{ background: "var(--bg-card-soft)", border: "1px solid var(--border-soft)" }}
              >
                <LogOut size={16} className="text-muted2 transition-colors group-hover:text-red-500" />
              </div>
              {expanded && (
                <span className="whitespace-nowrap text-xs text-muted2 transition-colors group-hover:text-red-500 lg:text-sm min-[2048px]:text-[15px]">
                  Cerrar sesión
                </span>
              )}
            </button>
          </div>
        </div>
      </aside>

      <main
        style={{ marginLeft: expanded ? "var(--sidebar-open)" : "var(--sidebar-closed)" }}
        className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden transition-[margin] duration-300"
      >
        <div
          className="eduai-dashboard-topbar z-10 shrink-0 border-b backdrop-blur-xl"
          style={{ background: "var(--bg-header)", borderColor: "var(--border-soft)" }}
        >
          <div className="mx-auto flex h-12 w-full max-w-[1660px] items-center justify-between px-3 lg:h-14 lg:px-6 min-[2048px]:h-16 min-[2048px]:max-w-[1960px] min-[2048px]:px-10">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted2 lg:text-xs min-[2048px]:text-[13px]">EduAI</p>
              <p className="hidden text-xs text-sub lg:block min-[2048px]:text-sm">Claw es tu espacio principal de trabajo en EduAI</p>
            </div>
            <div className="flex min-w-0 items-center gap-2 overflow-x-auto lg:gap-2.5 min-[2048px]:gap-3">
              <Link
                href="/biblioteca"
                aria-label="Biblioteca"
                className="group flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-all hover:-translate-y-0.5 lg:rounded-xl lg:px-3 lg:text-xs min-[2048px]:px-4 min-[2048px]:py-2 min-[2048px]:text-sm"
                style={{
                  background: "rgba(124,58,237,0.08)",
                  borderColor: "rgba(124,58,237,0.18)",
                  color: "#6d28d9",
                }}
              >
                <LibraryBig size={14} className="transition-transform group-hover:scale-110" />
                <span className="hidden lg:inline">Biblioteca</span>
              </Link>
              <Link
                href="/music"
                aria-label="Música"
                data-eduai-header-action="music"
                className="group flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-all hover:-translate-y-0.5 lg:rounded-xl lg:px-3 lg:text-xs min-[2048px]:px-4 min-[2048px]:py-2 min-[2048px]:text-sm"
                style={{
                  background: "rgba(16,185,129,0.08)",
                  borderColor: "rgba(16,185,129,0.20)",
                  color: "#047857",
                }}
                title="Abrir EduAI Music"
              >
                <Music2 size={14} className="transition-transform group-hover:scale-110" />
                <span className="hidden lg:inline">Música</span>
              </Link>
              <Link
                href="/soporte"
                aria-label="Reportar una falla"
                data-eduai-header-action="report"
                className="group flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-all hover:-translate-y-0.5 lg:rounded-xl lg:px-3 lg:text-xs min-[2048px]:px-4 min-[2048px]:py-2 min-[2048px]:text-sm"
                style={{
                  background: "rgba(37,99,235,0.07)",
                  borderColor: "rgba(37,99,235,0.18)",
                  color: "#2563eb",
                }}
                title="Reportar una falla"
              >
                <MessageSquareWarning size={14} className="transition-transform group-hover:scale-110" />
                <span className="hidden xl:inline">Reportar una falla</span>
                <span className="hidden lg:inline xl:hidden">Reporte</span>
              </Link>
              <span className="hidden text-sm text-sub lg:inline min-[2048px]:text-[15px]">{displayName}</span>
            </div>
          </div>
        </div>

        <div className="mx-auto flex min-h-0 w-full max-w-[1660px] flex-1 gap-3 overflow-hidden px-2 py-2 lg:gap-5 lg:px-5 lg:py-4 min-[2048px]:max-w-[1960px] min-[2048px]:gap-8 min-[2048px]:px-10 min-[2048px]:py-6">
          <div className="h-full min-h-0 min-w-0 flex-1">
            <ClawStudyConsole displayName={displayName} isAdmin={isAdmin} />
          </div>


        </div>
      </main>
    </div>
  )
}
