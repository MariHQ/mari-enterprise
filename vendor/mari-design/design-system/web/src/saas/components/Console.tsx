import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, Menu, X, Building2, Check, Loader2, LogOut } from "lucide-react";
import { Logo } from "@/components/Logo";
import { STEPS, stepById, type StepId } from "@saas/lib/pipeline";
import { authLogout, authSession, authSwitchOrg, type AuthInstallation, type AuthMeResponse } from "@saas/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { SourcesGroup } from "./sources";
import { LibraryGroup } from "./library";
import { AutomationsGroup } from "./automations";
import { QualityGroup } from "./quality";
import { TestingGroup } from "./testing";
import { ComplianceGroup } from "./compliance";
import { DocumentLineageGroup } from "./document-lineage";
import { AiMonitoringGroup } from "./ai-monitoring";
import { HealthGroup } from "./health";
import { SettingsGroup } from "./settings";
import { RenderCrashBoundary } from "./RenderCrashBoundary";

const VALID_IDS = new Set<string>(STEPS.map((s) => s.id));
const DEFAULT_STEP: StepId = "library";

const renderGroup = (id: StepId) => {
  switch (id) {
    case "sources":     return <SourcesGroup />;
    case "library":     return <LibraryGroup />;
    case "automations": return <AutomationsGroup />;
    case "quality":     return <QualityGroup />;
    case "testing":     return <TestingGroup />;
    case "compliance":  return <ComplianceGroup />;
    case "document-lineage": return <DocumentLineageGroup />;
    case "ai-monitoring": return <AiMonitoringGroup />;
    case "health":      return <HealthGroup />;
    case "settings":    return <SettingsGroup />;
  }
};

export const Console = ({ onBack }: { onBack: () => void }) => {
  const navigate = useNavigate();
  const params = useParams<{ stepId?: string }>();
  const urlStep = (params.stepId && VALID_IDS.has(params.stepId) ? params.stepId : DEFAULT_STEP) as StepId;

  const [activeId, setActiveId] = useState<StepId>(urlStep);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [auth, setAuth] = useState<AuthMeResponse | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [switchingOrg, setSwitchingOrg] = useState<string | null>(null);

  useEffect(() => {
    if (urlStep !== activeId) setActiveId(urlStep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlStep]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await authSession();
        if (!data.authenticated) throw new Error("unauthenticated");
        if (!cancelled) setAuth(data);
      } catch {
        if (!cancelled) {
          const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
          window.location.href = `/login?returnTo=${returnTo}`;
        }
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const goTo = (id: StepId) => {
    setActiveId(id);
    navigate(`/console/${id}`);
  };

  const active = stepById(activeId);
  const activeInstallation = auth?.installations.find((i) => i.orgSlug === auth.orgSlug) ?? auth?.installations[0] ?? null;

  const signOut = async () => {
    await authLogout().catch(() => null);
    window.location.href = "/login";
  };

  const switchOrg = async (inst: AuthInstallation) => {
    if (inst.orgSlug === auth?.orgSlug) return;
    setSwitchingOrg(inst.orgSlug);
    try {
      const next = await authSwitchOrg(inst.orgSlug);
      setAuth(next);
      window.dispatchEvent(new CustomEvent("mari:org-context-changed"));
    } finally {
      setSwitchingOrg(null);
    }
  };

  const topSteps = STEPS.filter((s) => !s.pinBottom);
  const bottomSteps = STEPS.filter((s) => s.pinBottom);

  const sidebarItem = (step: typeof STEPS[number], onPick?: () => void) => {
    const isActive = step.id === activeId;
    return (
      <li key={step.id}>
        <button
          onClick={() => { goTo(step.id); onPick?.(); }}
          className={`group w-full text-left flex items-center gap-2.5 pl-3 pr-2 py-2 md:py-1.5 rounded-md text-sm transition-all relative
            ${isActive
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-surface-2"}`}
        >
          {isActive && <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r bg-primary" />}
          <step.icon className={`h-3.5 w-3.5 ${isActive ? "text-primary" : ""}`} />
          <span className="flex-1 truncate">{step.name}</span>
          {!isActive && <ChevronRight className="h-3 w-3 opacity-0 md:group-hover:opacity-100 transition-opacity" />}
        </button>
      </li>
    );
  };

  const renderSidebarBody = (onPick?: () => void) => (
    <div className="flex-1 flex flex-col min-h-0">
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-0.5">{topSteps.map((s) => sidebarItem(s, onPick))}</ul>
      </nav>
      {bottomSteps.length > 0 && (
        <nav className="p-2 border-t border-border">
          <ul className="space-y-0.5">{bottomSteps.map((s) => sidebarItem(s, onPick))}</ul>
        </nav>
      )}
    </div>
  );

  return (
    <div className="h-[100dvh] w-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* HEADER */}
      <header className="h-12 shrink-0 border-b border-border bg-surface flex items-center px-2 sm:px-3 gap-1.5 sm:gap-3">
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden text-muted-foreground hover:text-foreground p-2 -ml-1 rounded-md hover:bg-surface-2 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-4 w-4" />
        </button>
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground p-2 sm:p-1.5 rounded-md hover:bg-surface-2 transition-colors" aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Logo />
        <span className="text-xs font-mono text-muted-foreground hidden md:inline">/ {active.name.toLowerCase()}</span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="ml-1 inline-flex items-center gap-2 min-w-0 max-w-[36vw] sm:max-w-[42vw] rounded-md border border-border bg-surface-2 px-2 sm:px-2.5 py-1.5 text-xs sm:text-sm text-foreground hover:bg-surface-3 transition-colors"
              disabled={authLoading || !auth}
              aria-label="Switch GitHub organization"
            >
              {authLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : <Building2 className="h-3.5 w-3.5 text-muted-foreground" />}
              <span className="truncate">{activeInstallation?.account ?? auth?.user.login ?? "Loading"}</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground rotate-90" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel className="text-xs text-muted-foreground">GitHub context</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(auth?.installations ?? []).map((inst) => (
              <DropdownMenuItem
                key={inst.installationId}
                onClick={() => switchOrg(inst)}
                className="gap-2"
              >
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{inst.account}</span>
                  <span className="block text-[11px] text-muted-foreground">{inst.repoCount} repos</span>
                </span>
                {switchingOrg === inst.orgSlug ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : inst.orgSlug === auth?.orgSlug ? (
                  <Check className="h-3.5 w-3.5" />
                ) : null}
              </DropdownMenuItem>
            ))}
            {auth && auth.installations.length === 0 && (
              <DropdownMenuItem disabled>No GitHub App installs available</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex-1" />

        <button
          onClick={signOut}
          className="text-muted-foreground hover:text-foreground p-2 sm:p-1.5 rounded-md hover:bg-surface-2 transition-colors"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      {/* MOBILE SIDEBAR DRAWER */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="relative h-full w-72 max-w-[85vw] bg-surface border-r border-border flex flex-col shadow-2xl">
            <div className="h-12 shrink-0 px-3 flex items-center justify-between border-b border-border">
              <Logo />
              <button onClick={() => setSidebarOpen(false)} className="text-muted-foreground hover:text-foreground p-2 -mr-1 rounded-md hover:bg-surface-2" aria-label="Close menu">
                <X className="h-4 w-4" />
              </button>
            </div>
            {renderSidebarBody(() => setSidebarOpen(false))}
          </aside>
        </div>
      )}

      {/* TWO-PANE */}
      <div className="flex-1 flex min-h-0">
        <aside className="hidden md:flex w-56 shrink-0 border-r border-border bg-surface flex-col min-h-0">
          {renderSidebarBody()}
        </aside>

        <main className="flex-1 flex flex-col min-w-0 bg-background">
          <div className="flex-1 overflow-y-auto">
            {authLoading ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <RenderCrashBoundary surface={`console.${active.id}`} resetKey={active.id}>
                {renderGroup(active.id)}
              </RenderCrashBoundary>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
