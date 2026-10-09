import { ArrowRight, Github, Database, Shield, Zap, Sparkles, Cpu, Check, MessageSquare, Workflow, FileCode2, GitPullRequest, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { SiteHeader } from "./SiteHeader";
import { CodeView } from "@/components/CodeView";
import { saasUrl } from "@landing/lib/saas";

const CALENDLY_URL = "https://calendly.com/henneberger-daniel/30min";

const PILLARS = [
  { icon: Database, name: "Knowledge", color: "text-primary-glow", desc: "Continuously ingests Slack threads, PRs, and architecture diagrams into a single source of truth." },
  { icon: Shield,   name: "Experience", color: "text-foreground",   desc: "Captures the hard-won tribal context that engineers carry in their heads." },
  { icon: Zap,      name: "Intuition",  color: "text-primary-glow", desc: "Style-tuned LLMs draft prose that sounds like your senior staff wrote it." },
  { icon: Sparkles, name: "Scale",      color: "text-foreground",   desc: "Detects stale docs before your on-call engineer learns the hard way." },
  { icon: Cpu,      name: "Automation", color: "text-rose2",        desc: "Ships pull requests — not Notion tickets. Humans review, machines toil." },
];

const INTEGRATIONS = ["Slack", "GitHub", "Jira", "VS Code", "Linear", "Figma"];

const COMMUNITY = {
  discord: "https://discord.gg/RdZyvwevp",
  slack: "https://join.slack.com/t/mari-v9h7907/shared_invite/zt-3xjdp77m9-Oh2~ZJO1toLUzHFgLeQgEA",
  github: "https://github.com/MariHQ",
};

const PR_DIFF = `diff --git a/docs/runbooks/auth/rotation.md b/docs/runbooks/auth/rotation.md
--- a/docs/runbooks/auth/rotation.md
+++ b/docs/runbooks/auth/rotation.md
@@ -1,5 +1,18 @@
-# Auth Gateway Rotation
-TODO: document this.
+# Auth Gateway — mTLS Certificate Rotation
+
+The auth gateway uses **mutual TLS (mTLS)** for all
+service-to-service traffic. Certificates rotate on a
+**90-day cadence**, orchestrated by Terraform.
+
+## Rotation Procedure
+1. \`terraform apply -target=module.auth_gateway.cert\`
+2. Verify fingerprint in \`auth-gateway-canary\`.
+3. Promote via the \`gateway-rollout\` workflow.`;

export const Landing = () => {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <SiteHeader />

      {/* HERO */}
      <section className="relative pt-24 pb-32">
        {/* Glow */}
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute left-1/2 -translate-x-1/2 top-[-10%] h-[640px] w-[1100px] rounded-full blur-3xl opacity-50"
               style={{ background: "radial-gradient(closest-side, hsl(var(--primary)/0.55), transparent 70%)" }} />
          <div className="absolute left-[15%] top-[20%] h-[420px] w-[420px] rounded-full blur-3xl opacity-40"
               style={{ background: "radial-gradient(closest-side, hsl(var(--purple)/0.7), transparent 70%)" }} />
          <div className="absolute right-[10%] top-[10%] h-[420px] w-[420px] rounded-full blur-3xl opacity-30"
               style={{ background: "radial-gradient(closest-side, hsl(var(--emerald)/0.6), transparent 70%)" }} />
          <div className="absolute inset-0 bg-grid opacity-[0.18]" />
        </div>

        <div className="mx-auto max-w-6xl px-4 sm:px-6 text-center">
          <a href="#" className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground border border-border rounded-full px-3 py-1 bg-surface/60 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald2 pulse-dot" />
            v3.2 — autonomous PR drafting now in GA
            <ArrowRight className="h-3 w-3" />
          </a>

          <h1 className="mt-6 text-[2rem] sm:text-5xl md:text-7xl font-semibold tracking-tight leading-[1.08] sm:leading-[1.02]">
            Documentation, grounded{" "}
            <span className="text-gradient">like the coast itself.</span>
          </h1>

          <p className="mt-6 mx-auto max-w-2xl text-lg text-muted-foreground leading-relaxed">
            Mari is the Docs-as-Code platform for engineering orgs that build to
            last. It draws tacit knowledge from Slack, Git, and architecture
            diagrams — then drafts, lints, and merges documentation pull
            requests with the patience of stone and the depth of the Bay.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a
              href={saasUrl("/install/github")}
              className="group inline-flex items-center gap-2 bg-foreground text-background hover:bg-foreground/90 font-medium text-sm px-5 py-3 rounded-xl glow-primary transition-all"
            >
              <Github className="h-4 w-4" />
              Start with GitHub
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href={saasUrl("/login")}
              className="inline-flex items-center gap-2 bg-surface border border-border hover:border-muted-foreground/50 text-foreground text-sm px-5 py-3 rounded-xl transition-colors"
            >
              See Demo
            </a>
          </div>
          <p className="mt-3 text-xs font-mono text-muted-foreground">Free to install · 5 minutes · we open the first PR</p>

          <div className="mt-14 flex items-center justify-center gap-2 text-xs font-mono text-muted-foreground">
            <Star className="h-3.5 w-3.5 text-amber2" />
            Trusted by platform teams at 200+ engineering orgs
          </div>
        </div>

        {/* Integrations */}
        <div className="mx-auto max-w-5xl px-4 sm:px-6 mt-16">
          <div className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground mb-6">
            Native integrations
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 grayscale opacity-60">
            {INTEGRATIONS.map(name => (
              <span key={name} className="font-mono text-lg text-muted-foreground/80">{name}</span>
            ))}
          </div>

          <div className="mt-16 flex flex-col items-center text-center">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">
              Join our community
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a href={COMMUNITY.discord} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-2 glass border border-border/80 rounded-full px-4 py-2 text-sm font-medium hover:border-foreground/40 transition-colors">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3a14.27 14.27 0 0 0-.69 1.404 18.27 18.27 0 0 0-5.487 0A12.7 12.7 0 0 0 9.69 3 19.79 19.79 0 0 0 5.93 4.369C2.52 9.394 1.59 14.302 2.05 19.13a19.94 19.94 0 0 0 6.045 3.04 14.6 14.6 0 0 0 1.292-2.092 12.83 12.83 0 0 1-2.034-.972c.17-.124.337-.252.498-.383a14.16 14.16 0 0 0 12.298 0c.162.131.328.26.498.383a12.86 12.86 0 0 1-2.038.974 14.6 14.6 0 0 0 1.292 2.09 19.94 19.94 0 0 0 6.045-3.04c.54-5.6-.913-10.46-3.629-14.761ZM9.34 16.27c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.951-2.418 2.157-2.418 1.205 0 2.18 1.085 2.157 2.418.002 1.334-.952 2.42-2.157 2.42Zm5.32 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.951-2.418 2.157-2.418 1.205 0 2.18 1.085 2.157 2.418 0 1.334-.952 2.42-2.157 2.42Z"/>
                </svg>
                Discord
              </a>
              <a href={COMMUNITY.slack} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-2 glass border border-border/80 rounded-full px-4 py-2 text-sm font-medium hover:border-foreground/40 transition-colors">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52ZM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313ZM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834ZM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312ZM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834ZM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312ZM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52ZM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313Z"/>
                </svg>
                Slack
              </a>
              <a href={COMMUNITY.github} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-2 glass border border-border/80 rounded-full px-4 py-2 text-sm font-medium hover:border-foreground/40 transition-colors">
                <Github className="h-4 w-4" />
                GitHub
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* PILLARS */}
      <section id="pillars" className="py-16 sm:py-24 border-t border-border/60">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <div className="text-xs font-mono text-primary-glow uppercase tracking-widest mb-3">/ The 5 Pillars</div>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">
              Documentation that compiles itself.
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              Five disciplines, one autonomous pipeline. Every pillar is observable, overridable, and shippable as code.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border/60 rounded-2xl overflow-hidden border border-border">
            {PILLARS.map((p, i) => (
              <div key={p.name} className="bg-surface p-6 hover:bg-surface-2 transition-colors group relative">
                <div className={`inline-flex items-center justify-center h-10 w-10 rounded-lg bg-surface-3 ${p.color}`}>
                  <p.icon className="h-5 w-5" />
                </div>
                <div className="mt-5 flex items-baseline gap-2">
                  <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                </div>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            ))}
            {/* Filler gradient cell to balance grid on lg */}
            <div className="bg-surface p-6 hidden lg:flex flex-col justify-between relative overflow-hidden">
              <div className="absolute inset-0 opacity-60"
                   style={{ background: "radial-gradient(closest-side, hsl(var(--primary)/0.35), transparent 70%)" }} />
              <div className="relative">
                <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">+ orchestration</div>
                <h3 className="mt-3 text-lg font-semibold">All five pillars, governed.</h3>
                <p className="mt-2 text-sm text-muted-foreground">Versioned policies, audit trails, role-based review.</p>
              </div>
              <a href={saasUrl("/login")} className="relative mt-6 self-start inline-flex items-center gap-2 text-sm text-primary-glow hover:text-foreground transition-colors">
                See Demo <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* WORKFLOW */}
      <section id="workflow" className="py-16 sm:py-24 border-t border-border/60">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div>
            <div className="text-xs font-mono text-emerald2 uppercase tracking-widest mb-3">/ Workflow</div>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">From chat noise to merged PR — in minutes.</h2>
            <ol className="mt-10 space-y-7">
              {[
                { icon: MessageSquare, title: "Ingestion", body: "Listens to designated Slack channels, GitHub PRs, and Figma comments. No bots, no copy-paste." },
                { icon: Workflow,      title: "AI Drafting", body: "Normalizes facts, runs RAG against your docs corpus, and synthesizes a draft in your house style." },
                { icon: GitPullRequest, title: "PR Review", body: "Opens a documentation pull request with citations. Engineers review like any other code change." },
              ].map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="h-9 w-9 rounded-lg bg-surface border border-border grid place-items-center text-primary-glow">
                      <s.icon className="h-4.5 w-4.5" />
                    </div>
                    {i < 2 && <div className="w-px flex-1 bg-border mt-2" />}
                  </div>
                  <div className="pb-2">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-xs text-muted-foreground">step.0{i + 1}</span>
                      <h3 className="text-lg font-semibold">{s.title}</h3>
                    </div>
                    <p className="text-muted-foreground mt-1 leading-relaxed">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* macOS terminal mock */}
          <div className="relative overflow-hidden">
            <div className="absolute -inset-6 bg-primary/20 blur-3xl rounded-full opacity-60 -z-10" />
            <div className="rounded-xl border border-border bg-surface shadow-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-surface-2">
                <span className="h-3 w-3 rounded-full bg-rose2/80" />
                <span className="h-3 w-3 rounded-full bg-amber2/80" />
                <span className="h-3 w-3 rounded-full bg-emerald2/80" />
                <div className="flex-1 min-w-0 text-center text-xs font-mono text-muted-foreground truncate">
                  mari · pull/2842 · docs/runbooks/auth/rotation.md
                </div>
                <FileCode2 className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="max-h-[440px] overflow-y-auto py-3">
                <CodeView kind="diff" value={PR_DIFF} />
              </div>
              <div className="border-t border-border bg-surface-2 px-4 py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs font-mono">
                <span className="text-emerald2 flex items-center gap-1.5">
                  <Check className="h-3 w-3" /> 12 additions
                </span>
                <span className="text-rose2">2 deletions</span>
                <span className="text-muted-foreground hidden sm:inline">opened by mari-bot · 2m ago</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ROI */}
      <section id="roi" className="py-16 sm:py-24 border-t border-border/60">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-6 sm:p-10 md:p-16">
            <div className="absolute inset-0 -z-0 opacity-90"
                 style={{ background: "radial-gradient(circle at 20% 30%, hsl(var(--primary)/0.25), transparent 55%), radial-gradient(circle at 85% 70%, hsl(var(--purple)/0.25), transparent 55%)" }} />
            <div className="relative grid md:grid-cols-3 gap-12 items-center">
              <div className="md:col-span-2">
                <div className="text-xs font-mono text-amber2 uppercase tracking-widest mb-3">/ Enterprise Trial</div>
                <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">
                  Reclaim <span className="text-gradient">38%</span> of engineering time lost to documentation.
                </h2>
                <p className="mt-4 text-muted-foreground max-w-xl">
                  Pilot Mari across one product surface in 14 days. SOC 2 Type II, self-hosted runners, no data leaves your VPC.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <a href={saasUrl("/install/github")} className="group inline-flex items-center justify-center gap-2 bg-foreground text-background hover:bg-foreground/90 font-medium text-sm px-5 py-3 rounded-xl transition-colors">
                  <Github className="h-4 w-4" />
                  Start with GitHub
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </a>
                <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 bg-surface-2 border border-border hover:border-muted-foreground/50 text-foreground text-sm px-5 py-3 rounded-xl transition-colors">
                  Talk to us
                </a>
              </div>
            </div>
          </div>

          <footer className="mt-12 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-mono text-muted-foreground">
            <Logo />
            <div className="flex items-center gap-4">
              <a href={COMMUNITY.discord} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Discord</a>
              <a href={COMMUNITY.slack} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Slack</a>
              <a href={COMMUNITY.github} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">GitHub</a>
            </div>
            <span>© 2026 Mari Systems · Docs-as-Code, grounded.</span>
          </footer>
        </div>
      </section>
    </div>
  );
};