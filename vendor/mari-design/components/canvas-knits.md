# Canvas knits (2026-07-23)

Triage of the canvas.html review round. Rules distilled from these notes live
in CONVENTIONS.md §13-§19. This file is the actionable fix list per page.
Scope tags: [component] means fix the shared component, [page] means fix the
page composition.

## Open product questions (not fixes, need a decision)

1. Should users be able to customize the widgets on the Overview page?
2. Add user-customized insights to Overview as a quick dashboard (impact
   cluster, trending line graphs)?

## Overview

- [x] [page] Reduce padding on the top stat tiles (CONVENTIONS §17):
      `Stat` now p-3, accent inset pl-4
- [x] [page] Denser layout so more content clears the fold (§17): via tile
      padding; further density is part of the widget-customization question
- [x] [page] Move Today's review above This week's digest (§17)
- [x] [component] Long task text clamps to two lines with a Show more toggle
      instead of unbalancing sibling boxes (§15): `OverviewTodayReview`
- [x] [page] Mobile: collapsible boxes kill the forever scroll, both default
      and overflow states (§17): `CardCollapseScope` in `layout/Card.tsx`,
      wired by `OverviewPage`
- [x] [component] Stress extremes: text never overflows the viewport, card
      headers truncate with an ellipsis (§12, §17): `Card` title truncates;
      overflow audit passes 646/646 frames
- [x] Empty state: no issues found

## Knowledge

- [x] [page] Stats strip above the results, below the search/tabs/sort bar
      (§13): `KnowledgeBrowser`
- [x] [component] Sort control shares the toolbar line, never its own row:
      row no longer wraps, label collapsed to "Sort" with the standard
      ArrowUpDown glyph, options in the dropdown (§13, §3)
- [x] [component] Tags render in the same bottom-left block as the status on
      every card, ALL CAPS pills, deduped against the status (§14)
- [x] [component] Card meta: when tags overflow they stack and the
      date/author line rides the bottom tag row (§14): `CardMeta` items-end
      with a min-width floor on the tag block
- [x] [page] "Open in lineage" directly below "View full history" (§16):
      `KnowledgeInspector`
- [x] [component] Removed the icon before "Open in lineage" (§16)
- [x] [page] "No results", "No document", and "Nothing selected" boxes share
      one `EmptyBox` wrapper and render at the same height (§15)
- [x] [component] Overflow long text: cards match established styles (§12):
      chips now shrink+truncate as flex items (`Chip` min-w-0)
- [x] [component] Documents tab: sort bar can no longer cover content on its
      line (§13): same collapsed-label fix
- [x] [page] Mobile: nothing runs off screen; overflow audit passes both
      views on every state

## Doc review

- [x] [page] Change queue runs the full page width under the rails (already
      true in the current layout; verified against §15)
- [x] [page] Refine: findings tally sits above the refinement skill buttons
      under the Refine heading (already true; verified against §13)
- [x] [component] Refine branch/tree watermark art removed (already removed
      at the component level; verified against §18)
- [x] [component] Block-type (H1) button matches the 36px height of the
      Bold/Italic/Underline buttons (§13): `DocReviewEditor`

## Answers

- [x] [component] Selection bar uses the underline variant to match the
      Knowledge tab bar, the one standard across the app (§13): `AnswersPage`

## Verification

- `npm run typecheck` clean
- `node scripts/overflow-audit.mjs --view both`: 0 defects in 646 frames
  (fixed one regression it caught: chips crushed to 2px in a squeezed meta
  row, solved in `Chip`/`CardMeta`/`DecisionCardFeature`)
- `node scripts/dash-sweep.mjs`: 0 dashes
