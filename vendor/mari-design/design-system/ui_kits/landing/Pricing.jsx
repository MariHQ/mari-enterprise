/* Landing — Pricing strip (3 cards, middle has halo) */
function Pricing() {
  const tiers = [
    { name: "Solo",   price: "$29",  per: "/ mo",        cta: "Start free", note: "For solo maintainers and indie hackers.", popular: false },
    { name: "Team",   price: "$350", per: "/ dev / mo",  cta: "Start free", note: "For 5–50 person engineering orgs.",      popular: true  },
    { name: "Scale",  price: "Talk", per: "to founders", cta: "Book Demo",  note: "Self-hosted, audit logs, SSO.",          popular: false },
  ];
  return (
    <section id="pricing" style={{ padding: "96px 0", borderTop: "1px solid hsl(var(--border) / 0.6)" }}>
      <div className="container">
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div className="kicker" style={{ color: "hsl(var(--purple2))" }}>/ Pricing</div>
          <h2 style={{ fontSize: 44, fontWeight: 600, letterSpacing: "-0.02em", margin: "12px 0 0" }}>
            Pay per developer. <span className="gradient-text">Cancel anytime.</span>
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {tiers.map(t => (
            <div key={t.name} style={{
              position: "relative", borderRadius: t.popular ? 24 : 12,
              border: t.popular ? "1px solid hsl(var(--primary) / 0.6)" : "1px solid hsl(var(--border))",
              background: t.popular ? "hsl(var(--card) / 0.75)" : "hsl(var(--card))",
              backdropFilter: t.popular ? "saturate(140%) blur(14px)" : "none",
              boxShadow: t.popular ? "0 0 40px -20px hsl(var(--primary) / 0.55)" : "none",
              padding: 24,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{t.name}</span>
                {t.popular && <span style={{ padding: "2px 10px", border: "1px solid hsl(var(--primary) / 0.4)",
                  borderRadius: 9999, fontFamily: "var(--font-mono)", fontSize: 10,
                  color: "hsl(var(--purple2))", textTransform: "uppercase", letterSpacing: "0.18em" }}>Most popular</span>}
              </div>
              <div style={{ marginTop: 12, display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.01em" }}>{t.price}</span>
                <span className="muted" style={{ fontSize: 13 }}>{t.per}</span>
              </div>
              <div className="muted" style={{ marginTop: 8, fontSize: 14 }}>{t.note}</div>
              <a href="#" className={`btn ${t.popular ? "btn-primary" : "btn-outline"}`} style={{ marginTop: 18, width: "100%" }}>{t.cta}</a>
              <ul style={{ margin: "18px 0 0", padding: 0, listStyle: "none", fontSize: 13, color: "hsl(var(--muted-foreground))" }}>
                <li style={{ display: "flex", gap: 8, padding: "4px 0" }}><span style={{ color: "hsl(var(--emerald2))" }}>✓</span> Unlimited PR drafts</li>
                <li style={{ display: "flex", gap: 8, padding: "4px 0" }}><span style={{ color: "hsl(var(--emerald2))" }}>✓</span> GitHub, Slack, Linear</li>
                {t.popular && <li style={{ display: "flex", gap: 8, padding: "4px 0" }}><span style={{ color: "hsl(var(--emerald2))" }}>✓</span> House-style fine-tune</li>}
                {!t.popular && t.name === "Scale" && <li style={{ display: "flex", gap: 8, padding: "4px 0" }}><span style={{ color: "hsl(var(--emerald2))" }}>✓</span> Self-hosted on your VPC</li>}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
window.Pricing = Pricing;
