# mari-design

Mari's brand and UX style guide — the **Brutalist Blueprint** system (white paper, ink lines, biscay water, espelette rust) — derived from the live `mari.guru` landing page and product console.

## Files

| File | For | Purpose |
|---|---|---|
| `BRAND-STYLE-GUIDE.md` | LLMs / coding agents | Machine-readable reference: exact color/type/spacing tokens, shape-language rules, do/don't table, and a ready-to-paste system-prompt fragment. Read this before generating or editing any Mari UI. |
| `Mari-Brand-Style-Guide.pdf` | Humans | The same system, laid out for reading — cover, color, type, shape/texture, and rules pages, rendered in the brand itself. |
| `style-guide-print.html` | — | Source for the PDF. Edit this, then re-render (see below). |
| [`components/`](./components/) | LLMs, humans, apps | The component library itself — real, typechecked TypeScript/React source, one file per component, organized by type (layout, forms, actions, data display, tokens). This is the canonical copy; not wired into any app's build. Start at `components/README.md`. |

## Sources

Built from:
- `mari/web/web/src/shared/index.css` — live color tokens, dark mode
- `mari/web/web/src/redesign/redesign.css` — dot-matrix texture, live implementation
- `mari/web/web/tailwind.config.ts` — token wiring
- `mari/web/brand-kit/README.md` — canonical palette + messaging, matched to the live site
- `mari/web/Mari Design System/colors_and_type.css` and `SKILL.md` — curated reference (shape/shadow system, spacing scale)
- `mari/web/web/STYLE.md` — voice and copy guidelines (condensed into §8 of the guide)
- `components/` originated from `mari-cc/console/src/saas/components/console-ui.tsx` (a monolithic file, since split one-component-per-file) — this repo is now the canonical copy; `mari-cc` was reverted to its original monolith rather than fork the source in two places

If any of those source files change, treat this repo as stale until it's regenerated to match.

## Regenerating the PDF

```sh
node -e '
import("playwright").then(async ({ chromium }) => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("file://" + process.cwd() + "/style-guide-print.html", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.pdf({ path: "Mari-Brand-Style-Guide.pdf", width: "210mm", height: "297mm", printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
  await browser.close();
});
'
```

(Requires `npm install playwright && npx playwright install chromium` once, if not already available.)
