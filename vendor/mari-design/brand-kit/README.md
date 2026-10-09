# Mari brand kit

Logo, LinkedIn banners, and a Calendly/social card matched to the **live mari.guru
brand** — the Brutalist Blueprint system: the schematic **M** mark, ink / paper /
biscay, a single rust accent, a blueprint dot grid, and sharp corners.

Open `preview.html` in a browser to see everything, including a live circle-crop
check on the avatar.

## Files

`out/` holds upload-ready PNGs, each exported at 2× (correct aspect ratio, retina-crisp,
accepted everywhere). `src/` holds the editable HTML each one renders from. `live/`
holds the real assets pulled from mari.guru — `mari-mark.svg` (the mark), `og.png`
(the link preview this kit matches), and `favicon.svg`.

| File | Size (2×) | Upload to |
|---|---|---|
| `out/avatar.png` | 800×800 | LinkedIn **profile photo** + Calendly **avatar** — inverted ink emblem, full-bleed so a circular crop reads as a stamped mark |
| `out/logo-square.png` | 800×800 | LinkedIn **company logo** (paper blueprint tile) |
| `out/li-personal.png` | 3168×792 | LinkedIn **personal profile** banner (1584×396) |
| `out/li-company.png` (or `.jpg`) | 4200×700 | LinkedIn **company page** cover — LinkedIn's exact spec (6:1, PNG/JPG < 3MB). Off-ratio images get rejected on upload. Just the centered mark + wordmark, since LinkedIn trims covers and shows the tagline in its own field. Put the tagline in LinkedIn's Tagline field. |
| `out/card.png` | 2400×1260 | Calendly event header · OpenGraph / social share (1200×630) |
| `out/x-header.png` | 3000×1000 | X / Twitter header (1500×500) — composition centered so the profile avatar (lower-left) stays clear |
| `out/mark-ink.png` | 1600×1600 | The mark alone, ink on **transparent** — for light backgrounds |
| `out/mark-white.png` | 1600×1600 | The mark alone, white on **transparent** (rust center) — for dark backgrounds |

## Calendly setup

- **Brand color:** `#10263B` (ink)
- **Avatar / logo:** `out/avatar.png`
- **Header image (if your plan supports one):** `out/card.png`

## Palette

| Name | Hex | Use |
|---|---|---|
| Ink | `#10263B` | mark, wordmark, top-left label, Calendly brand color |
| Biscay | `#1C3F60` | headlines, the mark's center square |
| Rust | `#B23A1E` | the corner accent bar, kicker bullet |
| Paper | `#FFFFFF` | background (with a faint blueprint dot grid) |
| Muted | `#5A6B7B` | mono subtext |

Type: **Inter** (800 for the `mari` wordmark and headlines) + **JetBrains Mono**
(the `▪ MARI.GURU` labels and microcopy). Sharp corners, thin ink frame, one rust
accent per canvas.

## Messaging

- Lead / kicker: **Docs with receipts**
- Headline: **Claim-checking for AI coding agents**
- Subline (larger canvases): *Your agent wrote the README. Mari checks it against
  the code — a free Claude Code plugin, on-device, no API key.*

## Re-rendering after an edit

Edit the HTML in `src/`, then from `brand-kit/`:

```sh
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --hide-scrollbars --disable-gpu \
  --force-device-scale-factor=2 --window-size=1584,396 \
  --virtual-time-budget=3500 \
  --screenshot="out/li-personal.png" "src/li-personal.html"
```

Swap `--window-size` and the file names per asset:
`logo-square` / `avatar` = 400,400 · `li-personal` = 1584,396 ·
`li-company` = 2100,350 (6:1, renders 2× to the 4200×700 spec) ·
`card` = 1200,630 · `x-header` = 1500,500 · `mark-ink` / `mark-white` = 800,800.
The `--virtual-time-budget` gives Google Fonts time to load before the screenshot.

For the **transparent** marks, add `--default-background-color=00000000` to the
Chrome command so the PNG keeps its alpha channel.
