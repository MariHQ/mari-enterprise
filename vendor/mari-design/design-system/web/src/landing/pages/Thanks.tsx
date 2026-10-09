import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { SiteHeader } from "@landing/components/SiteHeader";
import { saasUrl } from "@landing/lib/saas";

const Thanks = () => {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-md text-center">
          <CheckCircle2 className="h-12 w-12 text-primary-glow mx-auto mb-6" />
          <h1 className="text-3xl font-semibold tracking-tight">You're in.</h1>
          <p className="mt-3 text-muted-foreground">
            Subscription confirmed. We'll be in touch within one business day to spin up your workspace.
          </p>
          {sessionId && (
            <p className="mt-3 text-xs font-mono text-muted-foreground/70 break-all">
              Reference: {sessionId}
            </p>
          )}

          <div className="mt-8 flex items-center justify-center gap-3">
            <a href={saasUrl("/console")} className="group inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary-glow font-medium text-sm px-4 py-2.5 rounded-xl transition-colors">
              Open the console <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <Link to="/" className="inline-flex items-center gap-2 bg-surface-2 border border-border hover:border-muted-foreground/50 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
              Back home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Thanks;
