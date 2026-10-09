/* Landing — SiteHeader (floating glass nav with anchor links) */
function SiteHeader() {
  const links = [
    { label: "Pillars",   href: "#pillars" },
    { label: "Workflow",  href: "#workflow" },
    { label: "Pricing",   href: "#pricing" },
    { label: "Blog",      href: "#blog" },
  ];
  return (
    <header style={{
      position: "sticky", top: 16, zIndex: 50, padding: "0 24px",
      pointerEvents: "auto",
    }}>
      <div className="glass" style={{
        maxWidth: 1120, margin: "0 auto", padding: "8px 16px",
        borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Logo size={28} />
        <nav style={{ display: "flex", gap: 24 }}>
          {links.map(l =>
            <a key={l.label} href={l.href} style={{
              color: "hsl(var(--muted-foreground))", fontSize: 13, textDecoration: "none",
            }}>{l.label}</a>
          )}
        </nav>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a className="btn btn-ghost btn-sm" href="#login">Sign In</a>
          <a className="btn btn-primary btn-sm" href="#demo">Book Demo</a>
        </div>
      </div>
    </header>
  );
}
window.SiteHeader = SiteHeader;
