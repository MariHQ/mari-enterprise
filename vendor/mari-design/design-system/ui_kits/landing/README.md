# Landing UI kit — `mari.guru` marketing site

Recreates the public-facing site at https://mari.guru. Source: `web/src/landing/`.

## Components
- `Logo.jsx` — gradient mark + emerald status dot (shared with the SaaS kit)
- `SiteHeader.jsx` — sticky glass nav, anchor links, two CTAs
- `Hero.jsx` — announcement pill, gradient headline, primary/secondary CTAs, integrations row, three radial glow pools over a 48px grid
- `Pillars.jsx` — 5 pillars in a hairline-bordered grid + 6th orchestration tile with primary radial glow
- `TerminalDiff.jsx` — split section with copy on the left and a macOS-chromed PR diff on the right
- `Pricing.jsx` — 3-tier pricing strip; the middle tier is the "halo" treatment (glass + soft primary glow + "MOST POPULAR" pill)

Open `index.html` to see them composed in order.

## Design notes
- Hero glow recipe: blue radial center (`primary/0.55`), teal radial left (`purple/0.7`), emerald radial right (`emerald/0.6`) — all `blur(80px)` over a 48px grid at 18% opacity. **Don't reuse the recipe elsewhere on the page** — it's load-bearing for the hero alone.
- Section rhythm: every section after the hero is `border-top: 1px solid hsl(var(--border)/0.6)` and ~96px of vertical padding. Don't add additional containers or background fills between sections.
- The primary CTA (`btn-primary`) is the dark-foreground-on-light treatment with a primary glow shadow. Use only once per major section.
- All headings sit at semibold (600), tight letter-spacing (-0.02em), with a gradient-text span for the second clause. `gradient-text` mixes `foreground → primary → purple2`.
