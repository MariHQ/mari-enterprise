# SaaS console UI kit — `app.mari.guru`

Recreates the authenticated admin app at `app.mari.guru`. Source: `web/src/saas/`.

## Components
- `Console.jsx` exports `<ConsoleShell>` — a complete dashboard view with:
  - Left rail: workspace switcher + grouped navigation, hairline-bordered `Avatar/role` block at the bottom.
  - Top bar: breadcrumb, live status pill (`pill-dot` emerald), filter + primary CTA.
  - Stat strip: 4 cards with kicker label, big number, mono delta in semantic color.
  - Queue table: hairline header in `secondary/0.5`, mono columns, status pills tinted by `--amber2 / --purple2 / --emerald2 / --rose2` at 16% alpha.

## Design notes
- The console keeps the same warm-sand background as the marketing site — there is no separate dark dashboard skin.
- Hairline borders (1px, `--border`) carry every container; cards never use shadows in-app.
- All non-prose text in tables, columns, status, and kickers is in **Geist Mono** with mild uppercase letter-spacing for column headers (`0.18em`).
- The single primary action per page is the only `btn-primary`. Everything else is `btn-outline` or `btn-ghost`.

> This is a recreation of the live shell. The console source has only the entry component (`saas/components/Console.tsx`) and a thin header — most authenticated views are still being built.
