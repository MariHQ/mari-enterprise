# Handoff: Mari — Marketing Landing Page

## Overview
Marketing landing page for **Mari**, a product that reads pull requests, drafts the docs that should go with them, and waits for human approval before publishing — with optional localization. The page positions Mari as a quiet, dependable agent rooted in Basque mythology (Mari is the goddess of weather and storms in Basque folklore — flame, mountain, comb, moon are her recurring emblems).

The design system is built around the **Bay of Biscay**: bay-blue primary, with pine, terracotta, seafoam, gold-leaf and Basque-red secondaries used to color symbolic motifs (mountain, comb, lightning, moon, flame) across the page.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing intended look, motion, and behavior. They are **not production code** to copy directly.

The implementation task is to **recreate these designs in the target codebase's existing environment** (React, Vue, SvelteKit, Astro, etc.) using its established component patterns, routing, and styling solution. If no environment exists yet, the recommended starting point is Next.js or Astro with CSS variables for theming.

## Fidelity
**High-fidelity (hi-fi).** Final colors, typography, spacing, microcopy, illustrative SVGs and interaction states are all in place. Recreate pixel-perfectly using the codebase's existing UI primitives (buttons, cards, etc.) but preserve all design tokens and decorative SVG motifs exactly as authored.

## Files in this bundle
| File | What it is |
|---|---|
| `Mari Landing.html` | The landing page. Single self-contained HTML file with inline CSS and a small inline JS script for tweaks/easter-egg. Treat this as the source of truth. |
| `Pricing.html` | Pricing page linked from the nav. |
| `image-slot.js` | Drop-in web component used by `<image-slot>` placeholders. Not used on the landing page currently — keep only if `<image-slot>` appears in your HTML. |

---

## Page Structure

The landing page is a single scrollable page with the following sections, in order:

| # | Section | `data-screen-label` | Anchor / ID |
|---|---|---|---|
| 1 | Sticky nav | `Nav` | — |
| 2 | Hero + Pipeline graph | `Hero` | — |
| 3 | Basque proverb break | `Proverb` | — |
| 4 | How it works (weaving thread) | `How it works` | `#how` |
| 5 | Review checkpoint (diff/doc split) | `Review` | `#review` |
| 6 | Integrations grid | `Integrations` | `#integrations` |
| 7 | Mari speaks (large quote) | `Mari speaks` | — |
| 8 | CTA (Anboto silhouette) | `CTA` | — |
| 9 | Footer | — | — |

---

## Design Tokens

All tokens live as CSS custom properties on `:root` (light) and `[data-theme="dark"]` (dark). The page supports both themes via a `data-theme` attribute on `<body>`. Port these into the target codebase's tokens/theme file.

### Colors — Light theme

| Token | Value | Use |
|---|---|---|
| `--bg` | `#faf8f4` | Page background (warm cream) |
| `--surface` | `#f6f3ee` | Cards, raised surfaces |
| `--surface-2` | `#efebe6` | Window chrome, secondary surfaces |
| `--surface-3` | `#e2dbd5` | Tertiary surfaces |
| `--fg` | `#221e1c` | Primary text |
| `--muted-fg` | `#696059` | Secondary text |
| `--border` | `#ded6cf` | Hairline borders |
| `--border-strong` | `#c8bfb6` | Emphasized borders |
| `--primary` | `#0f4b76` | Accent (Bay-of-Biscay blue) |
| `--primary-glow` | `#217197` | Hover/glow variant of primary |
| `--primary-fg` | `#faf8f4` | Text on primary fills |
| `--emerald` | `#206f52` | Success, "add" diffs |
| `--amber` | `#bf6618` | Active/warning |
| `--rose` | `#cb1a41` | Error, "delete" diffs |

### Colors — Dark theme (`[data-theme="dark"]`)

| Token | Value |
|---|---|
| `--bg` | `#14110f` |
| `--surface` | `#1c1916` |
| `--surface-2` | `#221e1a` |
| `--surface-3` | `#2b2622` |
| `--fg` | `#f3eee8` |
| `--muted-fg` | `#9c9189` |
| `--border` | `#2d2823` |
| `--border-strong` | `#3d362f` |
| `--primary` | `#4ea3d1` |
| `--primary-glow` | `#7ec0e0` |
| `--primary-fg` | `#0b1218` |
| `--emerald` | `#4cc09a` |
| `--amber` | `#e89752` |
| `--rose` | `#ee5b7c` |

### Basque secondaries (themed — applied to iconography)

These colors are used to tint Mari's symbolic icons (mountain, comb, lightning, moon, flame) consistently across pipeline, thread, review, and integrations sections.

| Token | Light | Dark | Symbol |
|---|---|---|---|
| `--pine` | `#1f5a44` | `#4ea886` | Atlantic forest, mountain |
| `--basque-red` | `#b8222a` | `#e25a5f` | Ikurriña red, flame |
| `--terracotta` | `#a64a2c` | `#d57a52` | Caserío rooftop |
| `--seafoam` | `#5d9d8e` | `#88c2b3` | Cantabrian shallows, moon |
| `--gold-leaf` | `#c89a3c` | `#e0b85f` | Hammered gold, comb & sickle |

### Accent variants
The page supports four accent themes via `[data-accent="..."]` on `<body>`:
- `blue` (default) — uses `--primary`
- `emerald` — uses `--emerald`
- `amber` — uses `--amber`
- `rose` — uses `--rose`

Each accent rewrites `--accent`, `--accent-glow`, `--accent-soft` (8% alpha), `--accent-ring` (18% alpha).

### Typography

| Token | Value |
|---|---|
| `--font-sans` | `"Inter", ui-sans-serif, system-ui, -apple-system, sans-serif` |
| `--font-mono` | `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace` |

Inter weights used: `400, 500, 600, 700, 800` + italic `400, 500, 600`. JetBrains Mono weights: `400, 500, 600`.

**Type scale (most-used):**

| Use | Size | Weight | Letter-spacing | Line-height |
|---|---|---|---|---|
| Hero `h1` | `clamp(40px, 5.6vw, 64px)` | 700 | `-0.035em` | 1.04 |
| Section `h2` | `clamp(28px, 3.4vw, 40px)` | 700 | `-0.025em` | 1.1 |
| Proverb quote | `clamp(34px, 4.6vw, 52px)` | 700 | `-0.03em` | 1.06 |
| Mari summary quote | `clamp(24px, 3.2vw, 36px)` | 500 italic | `-0.025em` | 1.25 |
| Body | 16px | 400 | — | 1.5 |
| Eyebrow (mono) | 11px | 500 | `0.2em` uppercase | — |
| Pipeline meta (mono) | 11–12px | 400–500 | `0.08em` uppercase | — |

### Radius

| Token | Value |
|---|---|
| `--radius-sm` | `0.45rem` (~7px) |
| `--radius-md` | `0.55rem` (~9px) |
| `--radius` | `0.65rem` (~10px) |
| `--radius-lg` | `0.85rem` (~14px) |
| `--radius-xl` | `1rem` (16px) |

### Shadows

| Token | Value |
|---|---|
| `--shadow-card` | `0 1px 0 rgba(34,30,28,0.04), 0 1px 2px rgba(34,30,28,0.04)` |
| `--shadow-raised` | `0 1px 0 rgba(34,30,28,0.04), 0 10px 30px -16px rgba(34,30,28,0.18)` |
| `--shadow-glow` | `0 1px 0 0 rgba(15,76,117,0.6), 0 10px 30px -12px rgba(15,76,117,0.45)` |

Dark theme overrides `--shadow-card` and `--shadow-raised` with darker rgba values.

### Layout
- Page width: `.wrap` is `max-width: 1180px` with `padding: 0 32px`.
- Standard section vertical padding: `96px 0`.

---

## Section-by-section

### 1. Nav — `Nav`

Sticky header, 64px tall, backdrop-blurred (`saturate(140%) blur(10px)`), with a `color-mix(in srgb, var(--bg) 78%, transparent)` background and a 1px `--border` bottom.

**Layout (flex, justify-between):**
- Left: Brand mark (26×26) + wordmark "Mari" (17px, weight 700).
- Center: Nav links — `How it works`, `Review`, `Integrations`, `Pricing` (links to `Pricing.html`), `Docs`. 14px, `--muted-fg`, gap 28px.
- Right: "Sign in" text link + "Start free →" primary button.

#### Brand mark (logo)
A 26×26 rounded square (`--radius-sm`) showing **three cascading mountain ridges forming an M** on a cream background. Layers, back to front:
1. Cream sky background (`#fdfaf3`, dark theme `#f3eee8`).
2. Gold-leaf sun disc (`--gold-leaf`) top-left.
3. Back ridge: `color-mix(in srgb, var(--pine) 60%, white)` — gentle hills.
4. Mid ridge: `color-mix(in srgb, var(--terracotta) 75%, white)` — sharper hills.
5. Front M-mountain: `--primary` — two pointed peaks with a V-dip between (this is the M).
6. Gold ridge stroke: `--gold-leaf`, 1px, traces the front M-peaks.

The SVG is duplicated inline in the nav and footer. See `Mari Landing.html` ~line 1675 for the exact path data, or copy this snippet:

```html
<svg viewBox="0 0 32 32">
  <rect class="bm-bg" width="32" height="32" rx="7"/>
  <circle class="bm-sun" cx="8" cy="9" r="2.4"/>
  <path class="bm-back"  d="M0 32 L0 22 L8 16 L14 21 L21 14 L26 19 L32 16 L32 32 Z"/>
  <path class="bm-mid"   d="M0 32 L0 25 L6 19 L12 23 L19 15 L25 21 L32 17 L32 32 Z"/>
  <path class="bm-front" d="M0 32 L0 13 L9 5 L16 17 L23 5 L32 13 L32 32 Z"/>
  <path class="bm-ridge" d="M0 13 L9 5 L16 17 L23 5 L32 13"/>
</svg>
```

### 2. Hero + Pipeline graph — `Hero`

Padding: `88px 0 64px`. A radial gradient `--accent-soft` haloes the top.

**Head (centered, max 760px):**
- Pill badge: `"v2.0 · beta"` (seafoam-tinted mono chip) + `"Localization is here"`.
- H1: `Docs that keep up with your code.` with "code" wrapped in `<span class="ink-accent">` — italic, weight 600, color `--accent`.
- Sub: 19px, `--muted-fg`, max 580px, "Mari reads your pull requests, drafts the docs that should go with them, and waits for someone on your team to sign off. Translate if you need to. Ship when you're ready."
- CTAs: primary "Start free →" + ghost "Watch 90-second demo".
- Meta line: small emerald dot + mono text `"Free for open source · No card needed"`.

**Pipeline card (max-width 1100px, `--radius-xl`, `--shadow-raised`):**
A live PR pipeline mock for "PR #1284 · auth: add refresh-token rotation".
- Header: pulsing emerald dot ("live") + title + file/diff/run counts in mono.
- Five-node pipeline graph (`grid-template-columns: repeat(5, 1fr)`): **Commit (mountain icon · pine) → Analyze (comb · primary) → Draft (lightning · gold-leaf) → Human review (moon · seafoam) → Publish (flame · basque-red)**.
  - Each node: 56×56 rounded-square icon container, label below, mono sub-label below that.
  - `.node.done` = colored fill in its `--node-color`. `.node.active` = the moon node (Human review) with a 6px ring glow.
  - Connectors between nodes are 2px lines, filled to `--accent` when the prior node is done.
- Below the pipeline, a two-column details strip:
  - Left card: detail rows (Pages drafted, Symbols touched, Localized into).
  - Right card: amber "Awaiting" checkpoint with "Request changes" / "Approve & publish" mini-buttons.

The flame icon at the end of the pipeline uses `class="flame-anim"` — a CSS animation `flameBreathe 3.4s ease-in-out infinite` + `flameFlicker 1.7s ease-in-out infinite`. Disabled under `prefers-reduced-motion: reduce`.

### 3. Proverb — `Proverb`

Quiet break between hero and how-it-works. Surface background, 1px borders top and bottom. Padding `88px 0`.

Centered, max 920px:
- Quote: **"Doing beats saying."** — 700, with "saying." italic in `--basque-red`.
- Attribution: italic Basque original `Esan baino, egin.` · mono caps `EUSKAL ATSOTITZA`.
- Translation/elaboration: "Mari ships the draft, then steps back so you can do the part only you can do." — 17–19px, `--muted-fg`, max 520px.

### 4. How it works — `How it works` (`#how`)

Six-step weaving thread. Steps alternate left/right around a vertical gold-leaf rail.

**Section head:**
- Decorative SVG: three pollarded Basque oaks (`lepamotz haritzak`) on a hill, `--pine`-tinted.
- Eyebrow: `// HOW IT WORKS` in pine.
- H2: "How it works."
- Sub: "Mari runs on every pull request. You only step in at the review."

**Thread (`.thread`, max 980px):**
- An SVG rail (`.thread-svg`) is drawn behind the steps connecting node centers. It has two paths: a `--border` background rail and a gold (`var(--gold)`, `#d4a14a`) foreground rail that fills as the user scrolls. A small `.rail-head` circle marks the active fill position. Rail is computed in JS at the bottom of the file (`updateThread()` reads each `.dot` offset, builds the path, and updates `stroke-dashoffset` based on `scrollY`).
- Each `.t-step` is a 1fr/1fr grid with `column-gap: 120px`, `margin-bottom: 96px`.
- A step has:
  - 60px circular `.dot` (border 2px, swaps to `--step-color` + glow when the step is "lit" by scroll).
  - Icon inside the dot, 34×34.
  - Adjacent `.t-side` card (`--surface`, `--radius-lg`, 20×22 padding), with eyebrow `STEP NN`, H3, and one-sentence body.
- Six steps and their Mari-symbol colors:
  1. **Connect your repo** — mountain icon, `--pine`
  2. **Check the code changes** — comb icon, `--primary`
  3. **Draft the docs** — lightning icon, `--gold-leaf`
  4. **Pause for review** (with HUMAN red chip) — moon icon, `--seafoam`
  5. **Translate** — eye icon, `--terracotta`
  6. **Publish** — flame icon (`.flame-anim`), `--basque-red`

The HUMAN chip is a solid Basque-red pill with cream text — high contrast at small size.

Below 640px the thread collapses to a single column with no rail.

### 5. Review checkpoint — `Review` (`#review`)

Surface background, top + bottom borders.

**Head:** Eyebrow "// HUMAN IN THE LOOP" in basque-red, H2 "Approve before it ships.", sub describing the diff/doc split.

**Window mock (`.window`, full-width):**
- Title bar: traffic-light dots (red/yellow/green), active tab `docs/auth/refresh-tokens.mdx`, mono actions on the right.
- Body: `.diff-split` 1fr/1fr.
  - **Left pane** (`.diff-pane`): syntax-highlighted code diff with `+`/`−` gutter, add/del row tints (emerald/rose with low alpha). Uses spans `.kw .str .com .fn` for syntax color.
  - **Right pane** (`.doc-pane`): rendered docs preview. Eyebrow, H4, paragraphs, a `.doc-callout` accent box, and a `.doc-code` mono block.
- Footer bar (`.review-bar`): suggestion line with circular initial avatar `M`, italic inline quote ("Mari: …"), and two right-aligned buttons.

**Below the window:** `.review-features` — flat 5-column row of features separated by hairlines, no cards. Each cell: terracotta `.r-glyph` SVG (28px), 14px bold `.r-label`, 13px `--muted-fg` `.r-desc`.
1. **Diff and draft, side by side**
2. **Lints your style guide**
3. **Inline edits stay**
4. **Translations wait**
5. **Audit trail**

Collapses to 2-col below 900px, 1-col below 520px.

### 6. Integrations — `Integrations` (`#integrations`)

Surface band with top + bottom 1px borders.

Section head includes a seafoam SVG of the Bay of Biscay with waves and a cliff.

`.int-grid` is `repeat(4, 1fr)` with 14px gap; 8 cards. Each card (`.int-card`):
- 36×36 rounded-square logo tinted to the integration's `--int-color`.
- 15px bold name.
- 13px `--muted-fg` description.
- Mono status tag at the bottom: green dot + "Available" (or muted "Enterprise").

| Card | `--int-color` | Status |
|---|---|---|
| GitHub | `--fg` | Available |
| GitLab | `--terracotta` | Available |
| Bitbucket | `--primary` | Available |
| Docs targets | `--pine` | Available |
| Localization | `--seafoam` | Available |
| Slack & Linear | `--basque-red` | Available |
| CI providers | `--gold-leaf` | Available |
| SSO & SCIM | `--muted-fg` | Enterprise (muted) |

Collapses to 2-col below 900px.

### 7. Mari speaks — `Mari speaks`

A dedicated, centered section between Integrations and CTA. Padding `96px 0` on `--bg`. Max 820px, padded 0 32px.

Layout (flex-column, centered, gap 28px):
1. **Mark**: 56px red-tinted circle (`color-mix(--basque-red 10%, --surface)` background, `--basque-red 25%` border), holding the animated flame SVG (30×30, `--basque-red` color).
2. **Quote**: large italic 500 sans-serif, `clamp(24px, 3.2vw, 36px)`, `--fg`. Text: *"I'll keep an eye on the PR. When the diff lands, I'll draft the docs — and tap you when it's your turn."*
3. **Cite**: mono caps `0.22em` letter-spacing, `--basque-red`. Text: `— MARI · ON WHAT HAPPENS NEXT`.

### 8. CTA — `CTA`

Surface background. Behind the content, an `.anboto` absolutely-positioned SVG silhouette of Anboto mountain (where Mari lives) at the bottom — `opacity: 0.10` (light), `0.18` (dark).

Centered content (`.cta-inner`, padding `80px 24px`):
- Animated flame SVG (88px, basque-red).
- Eyebrow `// GET STARTED`.
- H2 "Give it a try."
- Sub: "Free for open source. Takes about two minutes to install. See what it does on your next PR."
- Buttons: primary "Install on GitHub →" + ghost "Book a 20-min walkthrough".

### 9. Footer

40px top padding, 56px bottom. 1px `--border` top.

Flex row:
- Left: small brand mark (22×22) + mono `© 2026 Mari.guru`.
- Right: link row — Changelog, Privacy, Terms, Status, Security. Hover → `--fg`.

---

## Interactions & Behavior

### Theme & accent
- `<body data-theme="light|dark" data-accent="blue|emerald|amber|rose">` controls theme + accent.
- Tweaks panel (fixed bottom-right, hidden by default — `.tweaks.open` to show) provides theme toggle + accent swatches. The HTML hosts both states; wire to user preference / OS preference however your codebase normally handles theming.

### Flame animation
`.flame-anim` runs two CSS keyframe animations (`flameBreathe`, `flameFlicker`) on every flame SVG. Disabled under `prefers-reduced-motion: reduce`.

### Pulse on the pipeline header
`.live-pulse` runs `pulse 2s ease-out infinite` — an emerald ring expanding outward.

### Pipeline node states
Three node states: default (muted), `.done` (filled with `--node-color`), `.active` (the moon node — adds a 6px outer ring + amber/seafoam glow). Connector between nodes also turns `--accent` when the prior node is done.

### Weaving thread (scroll-linked)
On the "How it works" section, the gold rail fills as the user scrolls past each step:
1. JS reads each `.t-step .dot` element's center position and builds an SVG path that visits each node.
2. `stroke-dasharray` is set to the total path length; `stroke-dashoffset` is updated on scroll.
3. The `.rail-head` circle moves along the path to mark the active fill position.
4. As the rail head passes each step's node, that step gets a `.lit` class which fades the side card to full opacity and lights the dot.

This logic is in an inline `<script>` at the bottom of `Mari Landing.html`. Recreate it using the codebase's normal scroll-listener / IntersectionObserver patterns. The visual goal is: rail draws steadily as you scroll, each step lights up exactly when its node is reached.

### Easter egg — lightning strike
There's a keyboard easter egg: pressing `m` triggers a sickle-arc lightning bolt drawing across the screen (`.lightning-strike` overlay with `lightningDraw` / `lightningFade` animations). Optional; remove if it doesn't fit. Disabled under `prefers-reduced-motion`.

### Buttons
- `.btn-primary` — `--accent` background, `--primary-fg` text, hover lifts 1px and brightens to `--accent-glow`.
- `.btn-ghost` — `--surface` background, `--border` outline, hover deepens to `--surface-2` + `--border-strong`.
- Arrow icon (`.arrow`) inside buttons translates +2px on hover.

### Hover states
- Nav links: `--muted-fg` → `--fg`.
- Integration cards: border → `--accent-ring`, picks up `--shadow-card`.

### Responsive breakpoints
- `≤ 900px`: pipeline stays 5-col but details stack; `.review-features` → 2-col; `.diff-split` → stacked; integrations → 2-col; pricing → 1-col; nav links hidden.
- `≤ 640px`: `.thread` rail SVG hidden; steps become a single-column flex layout with the node before the card.
- `≤ 520px`: `.review-features` → 1-col.

---

## State / wiring needs

The current HTML is static. To productize:

- **Theme + accent** — store in user prefs or localStorage; reflect on `<body data-theme>` / `<body data-accent>`.
- **CTA buttons** — wire to the actual GitHub App install URL and demo booking flow.
- **Nav `Pricing` link** — currently points to `Pricing.html`; route to the real pricing route in the codebase.
- **Sign in** — currently a placeholder anchor.
- **Pipeline card** — the on-page mock is purely visual. If you want it data-driven (real PR), expose props for: PR title, file count, additions, deletions, run hash, node states, page list, localization targets.

---

## Assets

All visual assets in the page are **inline SVG** — no external image files. This includes:

- Brand mark (cascading-mountains M).
- Pipeline node icons: mountain, comb, lightning, moon, flame.
- Thread step icons: same five + eye (for translate step).
- Decorative section-head SVGs: oak grove (How it works), Bay of Biscay coastline (Integrations).
- Anboto silhouette behind CTA.
- Integration card logos: GitHub (real glyph), GitLab (real glyph), Bitbucket / Docs / Localization / Slack / CI / SSO (simplified geometric stand-ins — replace with real brand glyphs when shipping).
- Flame, lightning, syntax-highlighting tokens.

Fonts are loaded from Google Fonts (`Inter` + `JetBrains Mono`). Move to the codebase's standard font-loading mechanism (`next/font`, `@fontsource`, etc.).

There is **no logotype image file** — the wordmark is plain text in Inter 700.

---

## Implementation checklist

1. Port design tokens (CSS custom properties or the codebase's equivalent theme object).
2. Build shared primitives: `Button`, `Pill`, `Eyebrow`, `Card`, `Window` (traffic-light frame), `MariFlame` (the animated flame SVG), `MariMark` (the cascading-mountain logo).
3. Build each section as its own component, in the order listed in **Page Structure**.
4. Implement the scroll-linked thread rail (section 4). This is the only nontrivial interaction.
5. Hook up theme + accent toggle if you ship a Tweaks-like panel; otherwise drive theme from system preference.
6. Wire CTA buttons to real install / demo URLs.
7. Replace integration card placeholder glyphs with real brand SVGs.
8. Add the `prefers-reduced-motion` guards for flame + lightning easter egg.

---

## Notes

- The page is deliberately quiet — let typography and the Basque-coast iconography do the work. Avoid adding stock illustrations or stat counters.
- Mari speaks in **first person** in the dedicated "Mari speaks" section and in the review-bar inline suggestion. Keep that voice consistent — short, calm, no exclamation marks.
- All `data-comment-anchor` attributes can be stripped on production export; they're review-tool plumbing from the design phase.
- All `data-screen-label` attributes can also be stripped.
