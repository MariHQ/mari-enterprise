/* SaaS — Console (admin app sidebar + main panel) */
function ConsoleShell({ user = "alex@acme.dev" }) {
  const nav = [
    { id: "queue",     label: "Queue",        count: 12 },
    { id: "sources",   label: "Sources",      count: 4  },
    { id: "policies",  label: "Policies",     count: null },
    { id: "audit",     label: "Audit log",    count: null },
    { id: "settings",  label: "Settings",     count: null },
  ];
  const [active, setActive] = React.useState("queue");
  const queue = [
    { id: 2842, file: "docs/runbooks/auth/rotation.md",          status: "draft",  age: "2m",  by: "mari-bot" },
    { id: 2841, file: "docs/architecture/tenant-isolation.md",   status: "review", age: "14m", by: "mari-bot" },
    { id: 2840, file: "docs/onboarding/contractor-checklist.md", status: "merged", age: "1h",  by: "alex"     },
    { id: 2839, file: "docs/runbooks/db/failover.md",            status: "draft",  age: "3h",  by: "mari-bot" },
    { id: 2838, file: "docs/api/auth/v3/migration.md",           status: "review", age: "5h",  by: "mari-bot" },
  ];
  const statusColor = {
    draft:  { bg: "hsl(var(--amber2) / 0.16)",   fg: "hsl(var(--amber2))"   },
    review: { bg: "hsl(var(--purple2) / 0.16)",  fg: "hsl(var(--purple2))"  },
    merged: { bg: "hsl(var(--emerald2) / 0.16)", fg: "hsl(var(--emerald2))" },
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", height: "100vh", background: "hsl(var(--background))" }}>
      {/* Sidebar */}
      <aside style={{ borderRight: "1px solid hsl(var(--border))", padding: "20px 14px",
                       display: "flex", flexDirection: "column", gap: 4, background: "hsl(var(--secondary) / 0.4)" }}>
        <div style={{ padding: "0 8px 16px" }}><Logo size={26} /></div>
        <div className="kicker" style={{ padding: "0 8px", marginBottom: 6 }}>Workspace</div>
        <div style={{ padding: "8px 10px", borderRadius: 8, background: "hsl(var(--card))",
                       border: "1px solid hsl(var(--border))", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Acme · prod</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "hsl(var(--muted-foreground))" }}>⌘K</span>
        </div>
        <div className="kicker" style={{ padding: "16px 8px 6px" }}>Navigate</div>
        {nav.map(n => (
          <button key={n.id} onClick={() => setActive(n.id)} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "8px 10px", borderRadius: 8, border: 0, cursor: "pointer",
            background: active === n.id ? "hsl(var(--card))" : "transparent",
            color: active === n.id ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
            fontWeight: active === n.id ? 600 : 400, fontSize: 13, textAlign: "left",
            border: active === n.id ? "1px solid hsl(var(--border))" : "1px solid transparent",
          }}>
            <span>{n.label}</span>
            {n.count != null && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11,
              padding: "1px 8px", borderRadius: 9999, background: "hsl(var(--secondary))" }}>{n.count}</span>}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ padding: 10, border: "1px solid hsl(var(--border))", borderRadius: 10,
                       display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ height: 28, width: 28, borderRadius: 9999, background: "hsl(var(--surface-3, 30 18% 86%))",
                         display: "grid", placeItems: "center", fontWeight: 600, fontSize: 12 }}>A</div>
          <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <span style={{ fontSize: 12, fontWeight: 500 }}>{user}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "hsl(var(--muted-foreground))" }}>admin</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ overflow: "auto" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "14px 28px", borderBottom: "1px solid hsl(var(--border))" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "hsl(var(--muted-foreground))" }}>acme</span>
            <span style={{ color: "hsl(var(--muted-foreground))" }}>/</span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Queue</span>
            <span className="pill" style={{ marginLeft: 4 }}><span className="pill-dot" /> live</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-outline btn-sm">Filter</button>
            <button className="btn btn-primary btn-sm">+ New source</button>
          </div>
        </header>
        <section style={{ padding: 28 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
            {[
              { l: "Drafts open",  v: "12",  d: "+3 today",  c: "hsl(var(--amber2))" },
              { l: "In review",    v: "5",   d: "−1 today",  c: "hsl(var(--purple2))" },
              { l: "Merged · 7d",  v: "84",  d: "+22 vs prev", c: "hsl(var(--emerald2))" },
              { l: "Stale docs",   v: "31",  d: "needs care", c: "hsl(var(--rose2))" },
            ].map(s => (
              <div key={s.l} className="card">
                <div className="kicker" style={{ marginBottom: 10 }}>{s.l}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.01em" }}>{s.v}</span>
                  <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: s.c }}>{s.d}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 12, overflow: "hidden", background: "hsl(var(--card))" }}>
            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 120px 80px 100px",
                           padding: "10px 16px", fontFamily: "var(--font-mono)", fontSize: 11,
                           color: "hsl(var(--muted-foreground))", borderBottom: "1px solid hsl(var(--border))",
                           background: "hsl(var(--secondary) / 0.5)", textTransform: "uppercase", letterSpacing: "0.18em" }}>
              <span>PR</span><span>File</span><span>Status</span><span>Age</span><span>Author</span>
            </div>
            {queue.map((q, i) => (
              <div key={q.id} style={{
                display: "grid", gridTemplateColumns: "80px 1fr 120px 80px 100px",
                padding: "12px 16px", fontSize: 13, alignItems: "center",
                borderBottom: i < queue.length - 1 ? "1px solid hsl(var(--border))" : "none",
              }}>
                <span style={{ fontFamily: "var(--font-mono)", color: "hsl(var(--purple2))" }}>#{q.id}</span>
                <span style={{ fontFamily: "var(--font-mono)" }}>{q.file}</span>
                <span><span style={{
                  display: "inline-block", padding: "2px 10px", borderRadius: 9999,
                  background: statusColor[q.status].bg, color: statusColor[q.status].fg,
                  fontFamily: "var(--font-mono)", fontSize: 11,
                }}>{q.status}</span></span>
                <span style={{ fontFamily: "var(--font-mono)", color: "hsl(var(--muted-foreground))" }}>{q.age}</span>
                <span style={{ fontFamily: "var(--font-mono)", color: "hsl(var(--muted-foreground))" }}>{q.by}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
window.ConsoleShell = ConsoleShell;
