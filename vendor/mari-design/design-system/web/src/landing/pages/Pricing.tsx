import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { SiteHeader } from "@landing/components/SiteHeader";

const CALENDLY_URL = "https://calendly.com/henneberger-daniel/30min";
const CHECKOUT_URL = "https://api.mari.guru/checkout";

type Tier = {
  id: string;
  name: string;
  price: string;
  period: string;
  blurb: string;
  cta:
    | { kind: "checkout"; tier: "starter" | "team"; label: string }
    | { kind: "internal"; href: string; label: string }
    | { kind: "external"; href: string; label: string };
  features: string[];
  highlight?: boolean;
};

const TIERS: Tier[] = [
  {
    id: "starter",
    name: "Starter",
    price: "Free",
    period: "for one repository",
    blurb: "Try Mari on a single repo. PR drafts, staleness scans, and Slack ingest — manual review.",
    cta: { kind: "checkout", tier: "starter", label: "Get Starter" },
    features: [
      "1 repository",
      "Slack + GitHub ingest",
      "Daily staleness scan",
      "Manual PR review only",
      "Community support (Discord, Slack)",
    ],
  },
  {
    id: "team",
    name: "Team",
    price: "$350",
    period: "per developer / month",
    blurb: "For 5–50 person engineering orgs. Background agents on every repo, with reviewable PRs.",
    cta: { kind: "checkout", tier: "team", label: "Subscribe" },
    highlight: true,
    features: [
      "Unlimited repositories",
      "Background docs agents (overnight runs)",
      "Style-tuned LLM that mimics your house voice",
      "Auto-PR on staleness, with human approval gate",
      "Linear / Jira sync",
      "Email + Slack support, 1-business-day SLA",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "annual",
    blurb: "Self-hosted runners, SSO, audit, and a dedicated solutions engineer.",
    cta: { kind: "external", href: CALENDLY_URL, label: "Talk to us" },
    features: [
      "Everything in Team",
      "Self-hosted runners (no data leaves your VPC)",
      "SAML SSO, SCIM, audit log export",
      "SOC 2 Type II shared",
      "Dedicated solutions engineer",
      "Custom MSA, DPA, and security review",
    ],
  },
];

const Pricing = () => {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startCheckout = async (tier: "starter" | "team") => {
    setError(null);
    setPending(tier);
    try {
      const r = await fetch(CHECKOUT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, quantity: 1 }),
      });
      const data = await r.json();
      if (!r.ok || !data.url) throw new Error(data.detail || data.error || "Checkout failed");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setPending(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="text-xs font-mono text-primary-glow uppercase tracking-widest mb-3">/ Pricing</div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">Pay for the engineers you don't have to hire.</h1>
          <p className="mt-4 text-muted-foreground text-lg">
            Mari replaces a documentation backlog. Pricing scales with your team, not your stack.
          </p>
        </div>

        {error && (
          <div className="mx-auto max-w-xl mb-6 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-4">
          {TIERS.map((tier) => {
            const btnClass = `group w-full inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors ${tier.highlight ? "bg-primary text-primary-foreground hover:bg-primary-glow" : "bg-surface-2 border border-border hover:border-muted-foreground/50 text-foreground"}`;

            return (
              <div
                key={tier.id}
                className={`glass rounded-2xl p-6 flex flex-col border ${tier.highlight ? "border-primary/60 shadow-[0_0_40px_-20px_hsl(var(--primary)/0.55)]" : "border-border/80"}`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{tier.name}</h2>
                  {tier.highlight && (
                    <span className="text-[10px] font-mono uppercase tracking-widest text-primary-glow border border-primary/40 rounded-full px-2 py-0.5">
                      Most popular
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold tracking-tight">{tier.price}</span>
                  <span className="text-sm text-muted-foreground">/ {tier.period}</span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{tier.blurb}</p>

                <ul className="mt-6 space-y-2 text-sm">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="h-4 w-4 mt-0.5 text-primary-glow shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 pt-6 border-t border-border/60">
                  {tier.cta.kind === "checkout" ? (
                    <button
                      type="button"
                      disabled={pending !== null}
                      onClick={() => startCheckout(tier.cta.kind === "checkout" ? tier.cta.tier : "team")}
                      className={`${btnClass} disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      {pending === tier.cta.tier ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Redirecting…
                        </>
                      ) : (
                        <>
                          {tier.cta.label} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </>
                      )}
                    </button>
                  ) : tier.cta.kind === "external" ? (
                    <a href={tier.cta.href} target="_blank" rel="noopener noreferrer" className={btnClass}>
                      {tier.cta.label} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </a>
                  ) : (
                    <Link to={tier.cta.href} className={btnClass}>
                      {tier.cta.label} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-16 max-w-2xl mx-auto text-center text-sm text-muted-foreground">
          <p>
            Custom procurement, on-prem, or a different shape entirely?{" "}
            <a className="hover:text-foreground transition-colors" href={CALENDLY_URL} target="_blank" rel="noopener noreferrer">Book a call</a>{" "}
            and we'll figure it out.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Pricing;
