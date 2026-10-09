/* Landing — Hero (announcement pill, headline w/ gradient, CTAs, integrations row) */
function Hero() {
  const integrations = ["Slack", "GitHub", "Jira", "VS Code", "Linear", "Figma"];
  return (
    <section style={{ position: "relative", padding: "96px 0 128px" }}>
      {/* Glow recipe — radial pools + grid */}
      <div style={{ position: "absolute", inset: 0, zIndex: -1, overflow: "hidden", pointerEvents: "none" }}>
        <div style={{
          position: "absolute", left: "50%", top: "-10%", transform: "translateX(-50%)",
          height: 640, width: 1100, borderRadius: 9999, filter: "blur(80px)", opacity: 0.5,
          background: "radial-gradient(closest-side, hsl(var(--primary) / 0.55), transparent 70%)",
        }}/>
        <div style={{
          position: "absolute", left: "15%", top: "20%", height: 420, width: 420,
          borderRadius: 9999, filter: "blur(80px)", opacity: 0.4,
          background: "radial-gradient(closest-side, hsl(var(--purple) / 0.7), transparent 70%)",
        }}/>
        <div style={{
          position: "absolute", right: "10%", top: "10%", height: 420, width: 420,
          borderRadius: 9999, filter: "blur(80px)", opacity: 0.3,
          background: "radial-gradient(closest-side, hsl(var(--emerald) / 0.6), transparent 70%)",
        }}/>
        <div className="grid-bg" style={{ position: "absolute", inset: 0, opacity: 0.18 }}/>
      </div>

      <div className="container" style={{ textAlign: "center" }}>
        <a href="#" className="pill" style={{ textDecoration: "none" }}>
          <span className="pill-dot"/>
          v3.2 — autonomous PR drafting now in GA
          <span style={{ fontSize: 11 }}>→</span>
        </a>

        <h1 style={{
          marginTop: 24, fontSize: 72, fontWeight: 600, letterSpacing: "-0.02em",
          lineHeight: 1.02, maxWidth: 920, marginLeft: "auto", marginRight: "auto",
        }}>
          Documentation, grounded{" "}
          <span className="gradient-text">like the coast itself.</span>
        </h1>

        <p className="muted" style={{
          marginTop: 24, marginLeft: "auto", marginRight: "auto", maxWidth: 640,
          fontSize: 18, lineHeight: 1.6,
        }}>
          Mari is the Docs-as-Code platform for engineering orgs that build to last.
          It draws tacit knowledge from Slack, Git, and architecture diagrams — then
          drafts, lints, and merges documentation pull requests with the patience of
          stone and the depth of the Bay.
        </p>

        <div style={{ marginTop: 40, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12 }}>
          <a href="#" className="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5A12 12 0 0 0 0 12.5c0 5.3 3.4 9.8 8.2 11.4.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.3 3.6 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.3-3.2-.1-.3-.6-1.6.1-3.3 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 3 .1 3.3.8.8 1.3 1.9 1.3 3.2 0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 24 12.5 12 12 0 0 0 12 .5Z"/></svg>
            Start with GitHub →
          </a>
          <a href="#" className="btn btn-secondary">See Demo</a>
        </div>
        <div className="muted" style={{ marginTop: 12, fontSize: 12, fontFamily: "var(--font-mono)" }}>
          Free to install · 5 minutes · we open the first PR
        </div>

        <div className="muted" style={{ marginTop: 56, fontSize: 12, fontFamily: "var(--font-mono)" }}>
          ★ Trusted by platform teams at 200+ engineering orgs
        </div>
      </div>

      <div className="container" style={{ marginTop: 64 }}>
        <div className="kicker" style={{ textAlign: "center", marginBottom: 24 }}>Native integrations</div>
        <div style={{
          display: "flex", flexWrap: "wrap", justifyContent: "center",
          columnGap: 48, rowGap: 16, opacity: 0.6, filter: "grayscale(1)",
        }}>
          {integrations.map(n =>
            <span key={n} style={{ fontFamily: "var(--font-mono)", fontSize: 18, color: "hsl(var(--muted-foreground))" }}>{n}</span>
          )}
        </div>
      </div>
    </section>
  );
}
window.Hero = Hero;
