# Mari — Brand & UX Style Guide

**System name:** Brutalist Blueprint
**Brand:** Mari (mari.guru) — "Claim-checking for AI coding agents."
**Visual story:** an engineering schematic — white paper, ink lines, biscay water, espelette rust. Sharp, hairline-bordered, hard block shadows.

> An older warm-sand / cream "Docs-as-Code" theme is **deprecated**. If you find cream/tan/terracotta colors, Playfair Display, Lora, or soft rounded cards anywhere in this codebase, that is legacy — replace it, don't extend it.

This file is written to be pasted into an LLM system prompt or read directly by a coding agent before it generates or edits UI. It is the single source of truth for how Mari should look and sound. Sources: `mari/web/web/src/shared/index.css`, `mari/web/web/src/redesign/redesign.css`, `mari/web/web/tailwind.config.ts`, `mari/web/brand-kit/README.md`.

---

## 1. Color tokens

Stored as space-separated RGB channels so any consumer can wrap them with alpha: `rgb(var(--c-ink) / 0.6)`.

### Light (default)

| Token | Hex | RGB | Use |
|---|---|---|---|
| `--c-paper` | `#FFFFFF` | `255 255 255` | Page/app background |
| `--c-ink` | `#10263B` | `16 38 59` | Body text, hairline borders, the logo mark |
| `--c-ink-elev` | `#10263B` | `16 38 59` | Elevated-surface ink (same as ink in light mode) |
| `--c-flysch` | `#F0F2F5` | `240 242 245` | Light panel fill, hover states, code background |
| `--c-biscay` | `#1C3F60` | `28 63 96` | Headings, primary buttons, the mark's center square |
| `--c-biscay-2` | `#1E6FA8` | `30 111 168` | Links, hover/pressed accent, focus rings |
| `--c-espelette` | `#B23A1E` | `178 58 30` | The single hot accent — kickers, alerts, corner accent bar. **One per canvas.** |
| `--c-moss` | `#2C6E49` | `44 110 73` | Status: ok / healthy / approved |
| `--c-clay` | `#A05E1C` | `160 94 28` | Status: attention / warning / pending |

Derived: `--hairline: rgb(var(--c-ink) / 0.16)` (the workhorse divider), `--muted: rgb(var(--c-ink) / 0.62)` (secondary text).

### Dark (night-plan — the blueprint inverts, it does not become black)

| Token | Hex | RGB |
|---|---|---|
| `--c-paper` | `#0E2032` | `14 32 50` |
| `--c-ink` | `#EAF0F5` | `234 240 245` |
| `--c-ink-elev` | `#17324A` | `23 50 74` |
| `--c-flysch` | `#12293D` | `18 41 61` |
| `--c-biscay` | `#6FB1E6` | `111 177 230` |
| `--c-biscay-2` | `#1E6FA8` | `30 111 168` (unchanged) |
| `--c-espelette` | `#E8805E` | `232 128 94` |

### Rules

- **One espelette accent per canvas.** It marks the single most important thing on screen (a kicker, an alert, a corner tick) — never a whole button field, never repeated decoratively.
- Biscay is for **brand-weight** elements (headings, primary CTAs). Biscay-2 is for **interactive** elements (links, focus rings, hover states). Don't swap them.
- Status tones (moss/clay/espelette) are semantic, not decorative. Reuse the same tone for the same meaning everywhere: moss = healthy, clay = attention, espelette = blocked/alert.
- Never introduce a new hue outside this palette without updating this file first.

---

## 2. Typography

- **Display + body:** Inter — `'Inter', 'Helvetica Neue', Arial, sans-serif`. Weight 800 for the `mari` wordmark and marketing headlines; 700 for app/console headings; 400 for body prose.
- **Chrome + code:** JetBrains Mono — `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace`. Used for kickers/eyebrows, table headers, badges, counts, code, and any small uppercase label. Never use mono for body prose or headings.
- **No serif anywhere.** (Legacy Playfair Display / Lora is deprecated — see the warning at the top of this file.)

### Marketing scale (landing/brand surfaces)

| Role | Size | Weight | Tracking | Leading |
|---|---|---|---|---|
| H1 | `clamp(2.25rem, 4vw + 1rem, 4rem)` | 800 | `-0.03em` | 1.02 |
| H2 | `clamp(1.75rem, 2.2vw + 1rem, 2.75rem)` | 800 | `-0.02em` | 1.08 |
| H3 | `1.125rem` | 700 | normal | 1.3 |
| Body | `1rem` | 400 | normal | 1.6 |
| Lead | `1.125rem` | 400 | normal | 1.6 |

### App/console scale (denser — see §4 for why it differs from marketing)

| Role | Size | Weight |
|---|---|---|
| Page title | `22px` | 700, tracking `-0.015em` |
| Card title | `15px` | 600 |
| Body | `13–14px` | 400–500 |
| Chrome (table headers, badges, counts) | `10.5–11px`, JetBrains Mono, uppercase, tracking `0.08–0.18em` | 500 |

### The kicker/eyebrow pattern

Mari's signature label treatment: mono, uppercase, wide tracking, a small square bullet before the text.

```
▪ DOCS WITH RECEIPTS
```

```css
.kicker {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.24em;
  display: inline-flex; align-items: center; gap: 0.7em;
}
.kicker::before { content: ""; width: 0.62em; height: 0.62em; background: currentColor; }
```

Kicker color is **contextual**: espelette (rust) on marketing/brand surfaces, biscay-2 (blue) inside the app console. Don't mix them within one surface.

---

## 3. Shape language — two deliberate modes

This is the part most agents get wrong: **the brand identity and the app console use different shape rules on purpose.** Both are correct; pick the one matching where you're building.

### Brand mode (marketing site, landing pages, social/brand assets)

- **Radius: `0px`.** Everything is square. No exceptions except a rare true pill (`9999px`) for chip-shaped tags.
- **Hard offset block shadow**, never a soft glow: `4px 4px 0 rgb(var(--c-ink))` (or `2px 2px 0` for small elements).
- Buttons "press into the page" on interaction: the shadow collapses and the element shifts toward it.
  ```css
  .btn-primary { background: var(--ink); color: var(--paper); box-shadow: 4px 4px 0 var(--ink); }
  .btn-primary:hover { transform: translate(2px, 2px); box-shadow: none; }
  ```
- Hairline `1px solid ink` borders carry every container (`.frame`).

### App/console mode (product UI, dashboards, dense data screens)

- **Radius: 4–6px.** Sharp, but not literally zero — data-dense screens need a hair of softness to stay readable at scale.
- **No shadows at all.** Separation comes entirely from hairline `border-ink/15` borders. Depth is implied by hierarchy and spacing, never by drop shadow.
- Never add `box-shadow` to a card, button, menu, or drawer in console UI. If you're tempted to add elevation, add a border instead.

**Rule of thumb:** if you're building a page a customer signs into and stares at for hours (console/dashboard), use app mode. If you're building something that sells the product before login (landing, social cards, brand collateral), use brand mode.

---

## 4. The dot-matrix texture

The blueprint's signature background wash — a faint grid of dots, never a solid fill.

```css
.dot-grid {
  background-image: radial-gradient(rgba(var(--c-ink), 0.07–0.14) 1px, transparent 1.4px);
  background-size: 22px 22px;
  background-position: -1px -1px;
}
```

- Opacity varies by context: `0.14` in wide-screen gutters (more visible, nothing else there to compete), `0.07–0.08` behind actual content (must stay texture, never compete with foreground text/UI).
- Dark mode: bump to `0.10`.
- **Never** use the dot-grid as a solid background fill or apply it to small/dense UI (buttons, chips, table rows) — it's a large-surface texture only (page background, hero sections, empty states).

---

## 5. Iconography

- Icon set: **lucide-react**. Do not hand-draw icons, do not use a second icon library alongside it.
- No decorative/hand-drawn icons anywhere — no plants, leaves, sprigs, botanical illustrations, or "hand-sketched" wobble filters. If an icon needs a growth/onboarding metaphor, use `Rocket` or `TrendingUp`, not `Leaf` or `Sprout`.
- Default stroke width: lucide's default (2). Don't override per-icon unless there's a specific density reason.
- One brand treatment for avatars/marks — no per-item rainbow coloring "for visual interest." It adds noise without meaning.

---

## 6. Spacing & motion

- **4px base spacing scale:** 4, 8, 12, 16, 24, 32, 48, 64, 96px (`--space-1` through `--space-24`).
- **Motion:** `--ease-standard: cubic-bezier(0.2, 0.6, 0.2, 1)`. Durations: fast `120ms`, base `200ms`, slow `320ms`. Keep transitions purposeful (color, border, transform-on-press) — never decorative idle animation, never a wobble/jitter effect.

---

## 7. Component patterns

- **Cards/containers:** hairline `border-ink/15`, sharp corners per §3, `bg-paper`. In app mode, no shadow. In brand mode, optional hard block shadow.
- **Buttons:** three variants only — primary (solid ink or biscay fill), ghost/secondary (hairline border, transparent fill), danger (espelette border/text). No other button styles.
- **Badges/status pills:** one semantic 5-tone scale — `ok` (moss), `attention` (clay), `blocked` (espelette), `info` (biscay-2), `neutral` (ink/70). Legacy tone names (`approved`, `pending`, `flagged`, etc.) alias onto this scale — don't invent new tone names.
- **Tables:** mono uppercase column headers (`font-term text-[11px] uppercase tracking-[0.08em]`), hairline row dividers, no zebra striping.
- **Drawers/modals:** slide in from the right, hairline left border, no backdrop blur — a plain `ink/30` scrim is enough.

---

## 8. Voice & tone (condensed — full guide: `mari/web/web/STYLE.md`)

- **Plainspoken, genuine, a translator, dry wit, speak truth.** No hype, no fluffy metaphors, no grandiose claims. Every product claim must be true.
- Active voice. Short sentences. Sentence case for headings and UI — never title case.
- Serial comma, always. Contractions are fine.
- Mari has **no mascot voice** — never anthropomorphize the product.
- Product word list: "Mari" (never "mari" or "MARI" in prose), "detector" (not linter/scanner), "plugin" (not extension/add-on), "on-device" (not local-only/offline-first).

---

## 9. Do / Don't

| Do | Don't |
|---|---|
| One espelette accent per screen | Espelette as a repeated decorative color |
| Inter + JetBrains Mono only | Any serif, any third typeface |
| Hairline ink borders for separation | Soft drop shadows in app/console UI |
| lucide-react icons | Hand-drawn, plant, or "sketch filter" icons |
| Sharp corners (0 on brand, 4–6px in-app) | Large rounded corners (>8px), pill-shaped cards |
| Dot-matrix as a faint background wash | Dot-matrix as a solid fill or on small UI |
| Semantic 5-tone status scale | Ad-hoc new colors for "just this one badge" |

---

## 10. LLM prompt fragment

Paste this into a system prompt when generating Mari UI:

```
Build this in Mari's "Brutalist Blueprint" design system. Colors: paper #FFFFFF,
ink #10263B, biscay #1C3F60 (headings/primary), biscay-2 #1E6FA8 (links/hover),
espelette #B23A1E (single accent only), moss #2C6E49 / clay #A05E1C (status ok/
warn). Fonts: Inter (800 for headings, 400 body), JetBrains Mono (uppercase
labels/chrome only). If this is app/console UI: 4-6px radius, no shadows,
hairline ink/15 borders for separation. If this is marketing/brand UI: 0px
radius, hard 4px 4px 0 ink block shadows that collapse on button press. Icons
from lucide-react only, no decorative or plant iconography. Never use cream,
tan, terracotta, serif fonts, or soft rounded cards — that's a deprecated
theme.
```
