---
name: mari-design
description: Use this skill to generate well-branded interfaces and assets for Mari (mari.guru), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

Mari's brand is the **Brutalist Blueprint**, an engineering-schematic look: white paper, ink lines, biscay water, espelette rust. Sharp corners, hairline ink borders, hard offset block shadows. (An older warm-sand / "Docs-as-Code" cream theme is deprecated. Do not use it.)

## Quick map
- `README.md`: full brand context, content and visual foundations, iconography
- `colors_and_type.css`: drop-in CSS variables and base type rules. `@import` it from any prototype
- `assets/`: `mari-mark.svg` (the schematic "M" mark), icons, illustrations
- `preview/`: small swatch/spec cards, one concept each
- `ui_kits/Logo.jsx`: the logo lockup (mark plus lowercase `mari` wordmark)

## When in doubt
- Use **Inter** for display + prose (800 for headings and the `mari` wordmark), **JetBrains Mono** for kickers, code, and UI chrome.
- Background is **paper `#FFFFFF`**, foreground is **ink `#10263B`**. Biscay `#1C3F60` for headings, biscay-2 `#1E6FA8` for links, espelette `#B23A1E` as the single hot accent. Dark mode inverts to a night-plan (paper `#0E2032`, ink `#EAF0F5`).
- **Sharp corners** (radius 0) and **hard block shadows** (`4px 4px 0` ink). Never soft glows or rounded cards.
- **Hairline ink borders** carry containers. Section labels are mono uppercase with a square bullet: `▪ DOCS WITH RECEIPTS` (`.kicker`).
- Blueprint **dot-matrix** wash (`.dot-grid`) sits behind content as texture, never as a solid fill.
- The mark is the schematic **M** in a bordered square (`assets/mari-mark.svg`); the wordmark is lowercase **`mari`** in extrabold Inter. Use the paper variant on dark fields.
