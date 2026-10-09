/* Landing — Pillars (5-up grid + filler with glow) */
function Pillars() {
  const items = [
    { name: "Knowledge",  hue: "primary", desc: "Continuously ingests Slack threads, PRs, and architecture diagrams into a single source of truth." },
    { name: "Experience", hue: "fg",      desc: "Captures the hard-won tribal context that engineers carry in their heads." },
    { name: "Intuition",  hue: "primary", desc: "Style-tuned LLMs draft prose that sounds like your senior staff wrote it." },
    { name: "Scale",      hue: "fg",      desc: "Detects stale docs before your on-call engineer learns the hard way." },
    { name: "Automation", hue: "rose",    desc: "Ships pull requests — not Notion tickets. Humans review, machines toil." },
  ];
  const tint = { primary: "hsl(var(--purple2))", fg: "hsl(var(--foreground))", rose: "hsl(var(--rose2))" };
  return (
    <section id="pillars" style={{ padding: "96px 0", borderTop: "1px solid hsl(var(--border) / 0.6)" }}>
      <div className="container">
        <div className="kicker" style={{ color: "hsl(var(--purple2))", marginBottom: 12 }}>/ The 5 Pillars</div>
        <h2 style={{ fontSize: 48, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
          Documentation that compiles itself.
        </h2>
        <p className="muted" style={{ marginTop: 16, fontSize: 18, maxWidth: 640 }}>
          Five disciplines, one autonomous pipeline. Every pillar is observable, overridable, and shippable as code.
        </p>

        <div style={{
          marginTop: 48, display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
          gap: 1, background: "hsl(var(--border) / 0.6)",
          borderRadius: 16, overflow: "hidden", border: "1px solid hsl(var(--border))",
        }}>
          {items.map((p, i) => (
            <div key={p.name} style={{ background: "hsl(var(--card))", padding: 24 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                height: 40, width: 40, borderRadius: 8,
                background: "hsl(var(--surface-3, 30 18% 86%))", color: tint[p.hue],
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                     strokeLinecap="round" strokeLinejoin="round">
                  <ellipse cx="12" cy="5" rx="9" ry="3"/>
                  <path d="M3 5v14a9 3 0 0 0 18 0V5"/>
                  <path d="M3 12a9 3 0 0 0 18 0"/>
                </svg>
              </div>
              <div style={{ marginTop: 20, display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "hsl(var(--muted-foreground))" }}>0{i+1}</span>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{p.name}</h3>
              </div>
              <p className="muted" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>{p.desc}</p>
            </div>
          ))}
          <div style={{ background: "hsl(var(--card))", padding: 24, position: "relative", overflow: "hidden",
                        display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ position: "absolute", inset: 0, opacity: 0.6,
              background: "radial-gradient(closest-side, hsl(var(--primary) / 0.35), transparent 70%)" }}/>
            <div style={{ position: "relative" }}>
              <div className="kicker">+ orchestration</div>
              <h3 style={{ marginTop: 12, fontSize: 18, fontWeight: 600 }}>All five pillars, governed.</h3>
              <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>Versioned policies, audit trails, role-based review.</p>
            </div>
            <a href="#" style={{ position: "relative", marginTop: 24, alignSelf: "flex-start",
                                 color: "hsl(var(--purple2))", fontSize: 14, textDecoration: "none" }}>See Demo →</a>
          </div>
        </div>
      </div>
    </section>
  );
}
window.Pillars = Pillars;
