/* Landing — TerminalDiff + Pricing strip */
function TerminalDiff() {
  return (
    <section style={{ padding: "96px 0", borderTop: "1px solid hsl(var(--border) / 0.6)" }}>
      <div className="container" style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 64, alignItems: "center" }}>
        <div>
          <div className="kicker" style={{ color: "hsl(var(--emerald2))", marginBottom: 12 }}>/ Workflow</div>
          <h2 style={{ fontSize: 44, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
            From chat noise to merged PR — in minutes.
          </h2>
          <p className="muted" style={{ marginTop: 16, fontSize: 16 }}>
            Mari opens documentation pull requests with citations. Engineers review them like any other code change.
          </p>
          <div style={{ marginTop: 24 }}>
            <a className="btn btn-primary" href="#">View runbook →</a>
          </div>
        </div>

        <div style={{
          borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))",
          overflow: "hidden", boxShadow: "0 24px 48px -12px hsl(var(--foreground) / 0.18)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px",
                        borderBottom: "1px solid hsl(var(--border))", background: "hsl(var(--secondary))" }}>
            <span style={{ height: 12, width: 12, borderRadius: 9999, background: "hsl(var(--rose2) / 0.8)" }}/>
            <span style={{ height: 12, width: 12, borderRadius: 9999, background: "hsl(var(--amber2) / 0.8)" }}/>
            <span style={{ height: 12, width: 12, borderRadius: 9999, background: "hsl(var(--emerald2) / 0.8)" }}/>
            <div style={{ flex: 1, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11,
                          color: "hsl(var(--muted-foreground))" }}>
              mari · pull/2842 · docs/runbooks/auth/rotation.md
            </div>
          </div>
          <pre style={{
            margin: 0, padding: "14px 16px", fontFamily: "var(--font-mono)",
            fontSize: 12.5, lineHeight: 1.7, color: "hsl(var(--foreground) / 0.9)",
            whiteSpace: "pre-wrap",
          }}>
<span style={{ color: "hsl(var(--muted-foreground))" }}>--- a/docs/runbooks/auth/rotation.md</span>{"\n"}
<span style={{ color: "hsl(var(--muted-foreground))" }}>+++ b/docs/runbooks/auth/rotation.md</span>{"\n"}
<span style={{ color: "hsl(var(--purple2))" }}>@@ -1,5 +1,18 @@</span>{"\n"}
<span style={{ background: "hsl(var(--rose2) / 0.10)", color: "hsl(var(--rose2))" }}>{"- # Auth Gateway Rotation"}</span>{"\n"}
<span style={{ background: "hsl(var(--rose2) / 0.10)", color: "hsl(var(--rose2))" }}>{"- TODO: document this."}</span>{"\n"}
<span style={{ background: "hsl(var(--emerald2) / 0.10)", color: "hsl(var(--emerald2))" }}>{"+ # Auth Gateway — mTLS Certificate Rotation"}</span>{"\n"}
<span style={{ background: "hsl(var(--emerald2) / 0.10)", color: "hsl(var(--emerald2))" }}>{"+"}</span>{"\n"}
<span style={{ background: "hsl(var(--emerald2) / 0.10)", color: "hsl(var(--emerald2))" }}>{"+ The auth gateway uses **mutual TLS (mTLS)** for all"}</span>{"\n"}
<span style={{ background: "hsl(var(--emerald2) / 0.10)", color: "hsl(var(--emerald2))" }}>{"+ service-to-service traffic. Certificates rotate on a"}</span>{"\n"}
<span style={{ background: "hsl(var(--emerald2) / 0.10)", color: "hsl(var(--emerald2))" }}>{"+ **90-day cadence**, orchestrated by Terraform."}</span>{"\n"}
<span style={{ background: "hsl(var(--emerald2) / 0.10)", color: "hsl(var(--emerald2))" }}>{"+"}</span>{"\n"}
<span style={{ background: "hsl(var(--emerald2) / 0.10)", color: "hsl(var(--emerald2))" }}>{"+ ## Rotation Procedure"}</span>{"\n"}
<span style={{ background: "hsl(var(--emerald2) / 0.10)", color: "hsl(var(--emerald2))" }}>{"+ 1. `terraform apply -target=module.auth_gateway.cert`"}</span>{"\n"}
<span style={{ background: "hsl(var(--emerald2) / 0.10)", color: "hsl(var(--emerald2))" }}>{"+ 2. Verify fingerprint in `auth-gateway-canary`."}</span>
          </pre>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px",
                        borderTop: "1px solid hsl(var(--border))", background: "hsl(var(--secondary))",
                        fontFamily: "var(--font-mono)", fontSize: 11 }}>
            <span style={{ color: "hsl(var(--emerald2))" }}>✓ 12 additions</span>
            <span style={{ color: "hsl(var(--rose2))" }}>2 deletions</span>
            <span style={{ color: "hsl(var(--muted-foreground))" }}>opened by mari-bot · 2m ago</span>
          </div>
        </div>
      </div>
    </section>
  );
}
window.TerminalDiff = TerminalDiff;
