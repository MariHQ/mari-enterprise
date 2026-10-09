# Mari design system — layout & content conventions

Binding rules for every component and page. Derived from `updates.md` and
`canvas-knits.md`. When a component conflicts with a rule below, the rule wins.

## 1. Card / panel content order

Any card, drawer, panel, or inspector that is **not** a table lays its content
out top-to-bottom in exactly this order (skip what does not apply, never
reorder):

1. Header (title of the card)
2. Header summary (one line of supporting text)
3. Search bar, if the card has one
4. Title of the doc/content
5. Summary of the doc/content
6. Source badge
7. Status badge — source + status sit **on the left**; date and
   author/approver go **right-aligned on the same line** (or left-aligned on
   the same plumb line — pick one and keep it consistent inside a card)
8. References / Endpoints
9. Members / Connections
10. Owners
11. Buttons
12. Biggest action last

Use `<CardBody>` / `<CardMeta>` from `layout/CardShell.tsx` so the ordering and
spacing are literally the same object everywhere.

## 2. Actions

- **Confirm / next-step / primary actions go at the BOTTOM LEFT** of whatever
  they sit on. Not right, not centered.
- The affirmative action is `<Button variant="primary">` (biscay blue). A
  destructive one is `variant="danger"`; an explicit yes/approve on a
  confirmation is `variant="success"`.
- Secondary actions sit to the **right** of the primary on the same line
  (e.g. "Create review task" left, "Open document" right).
- Destructive actions (delete, remove, revoke) must go through
  `<ConfirmButton>` — never fire on first click.
- Every button must actually do something visible. If a control has no
  behaviour yet, wire it to local state that changes the UI (expand a table,
  open a drawer, toast) rather than leaving it inert.
- If a table has an action button, it goes in the **top right** of the table.

## 3. Tables

- Every column header is rendered by `<SortHeader>` (`data-display/sortable.tsx`)
  and shows a sort affordance. No bare `<th>` text.
- Column spacing is uniform: `px-4 py-2.5` on headers, `px-4 py-3` on cells.
  Use the shared `thClass` / `tdClass` exports.
- Numeric / middle "server"-type fields are centered (`align="center"`).
- **Status column placement**: first column by default. If a row has a
  clickable action, status is second-to-last. If there is no clickable item,
  status is last. Inside a small node/modal/popup or a timeline, status is last.
- Tables always have visible column headers, even inside panels and cards.
- Filter/select labels use **sentence case**: "All sources", "All statuses",
  "All regions" — never "All Region" or "All Sources".
- The sort control is the standard sort icon (`ArrowUpDown`); do not use an
  "A-Z" glyph.

## 4. Chips & badges

- All chips render **ALL CAPS** (`Chip` defaults `caps` to true). This includes
  `StatusChip`, `SeverityChip`, `Pill`, `TagChip`, `GradeChip`, and any bespoke
  chip inside a page or feature.
- Never hand-roll a chip with `<span className="rounded-full …">`. Import from
  `data-display/Chip.tsx`. Tag-like chips use `TagChip`, which must look
  identical to the chips in `TagPicker`.
- Selected/interactive chips highlight on **all four sides**
  (`border-biscay-2 ring-1 ring-biscay-2`), never just some edges.
- `verified` is **green**.
- Severity/state colors must never be the *only* signal — pair color with a
  dot, an icon, or a label (color-blind accessibility).

## 5. Typography & content

- **No em dashes (—) or en dashes (–) in user-visible copy.** Use a comma, a
  colon, a period, or the word "to" for ranges. (Code comments may keep them.)
- Dates always carry a year: `Jul 16, 2026`. Use `fmtDate` / `fmtDateTime`
  from `tokens/format.ts` — never format dates inline.
- Sentence case for labels and filter options; ALL CAPS only for chips and
  mono column headers.
- Server/region names come from `tokens/regions.ts` — one canonical spelling
  everywhere (`US West (us-west-2)` in prose/labels, `us-west-2` as a code).

## 6. Accessibility

- Disabled controls use `disabled:opacity-100` plus the explicit disabled
  palette in `actions/buttons.ts` — a darker, clearly-legible grey, not a
  washed-out 45% ghost.
- Body/secondary text is no lighter than `text-ink/70`. Meta/label text no
  lighter than `text-ink/65`.
- Icons default to 18px at stroke 1.9 (`IconBase`) so they read at a glance.
- Charts and status indicators need a non-color channel (pattern, icon, label).
- Status markers must not look like radio buttons — a circle means "choose me".
  Use a square/checkmark/bar marker for state.

## 7. Forms

- Any member/owner/assignee picker is a **searchable** combobox
  (`forms/Combobox.tsx` with `search`), never a plain select.
- Owner, priority, and due date sit on one line, in that order.
- Dropdown options are Capitalized where they name a role or status.

## 8. Errors

- All error/warning copy comes from `feedback/errors.ts`. Render with
  `<ErrorMessage id="…" />` or `<Alert>`. No bespoke error strings.

## 9. Skeletons

Existing skeleton/loading work must be preserved. If a component has a
`loading` prop it keeps it.

**A skeleton keeps its labels.** Everything the app already holds at first
paint renders as its real self: section headings, card titles, column headers,
field labels, tab names, the page title, units, static helper text,
empty-state chrome. Only the values the response owes get a bar. A grey
rectangle where a known word goes throws away information the reader could
already be using, makes every loading screen in the console identical and
unplaceable, and relays the layout out when the real text arrives at a
different width.

The inverse is worse and is also forbidden: **never render a value the query
has not returned.** A count, a name, a date, a status or a total drawn beside
a body of grey bars is invented data. If a title interpolates a value
(`Repository audit, {repo}`), only the part that is the page's own may show.

Consequently:

- A loading region is not `aria-hidden` wholesale — the labels in it are
  content. `aria-hidden` sits on the decorative bars (the `Skeleton` primitive
  sets its own); the region carries `aria-busy="true"` and names what is
  loading once, politely (`SkeletonRegion`).
- A skeleton occupies the loaded thing's geometry: a skeleton row is the
  height of a real row, a skeleton chip the size of a real chip, a page
  skeleton sits in the §11 container and grid. Nothing may jump on swap.
- A control that cannot act yet is drawn disabled (§2, §6), not as a bar,
  where drawing it disabled is what keeps the row's height honest.

## 10. Responsiveness

Components are **desktop-first, fixed-width**. Do not introduce
`flex-col … lg:flex-row` stacking or `w-full … lg:w-[Npx]` widths on desktop
components — that made drawers render mobile-style in the desktop canvas. Pages
handle mobile via the `mobile` prop on the page component, not via component
breakpoints.

## 11. Page layout grid

Every console page sits on the same grid so that, flipping between pages, the
outer borders and the internal plumb lines never move.

**Container.** One width for every page: `max-w-[1400px]`. No page uses
`max-w-4xl/5xl/6xl` any more; a narrower content column is expressed by the
grid inside the container, never by shrinking the container itself.

**Vertical rhythm.**
- Page header block first, then `mt-6` before the body. Never `mt-2`/`mt-5`.
- Between sibling cards/sections in the body: `gap-5` (a single
  `flex flex-col gap-5` or `grid gap-5`), never ad-hoc `mt-4`/`mb-6` stacking.

**Filling the width.** The body must occupy the full container. A page whose
content only covers the left half with dead space on the right is a bug: either
widen the content, or use the standard two-column split below. This was the
single most visible inconsistency across the console.

**Two-column split.** Pages with a main column plus a supporting rail use:

    <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-5">

- Standard rail: **320px** (Audit, Insights, Publish, Settings).
- Knowledge inspector rail: **360px**.
- Lineage drawer rail: **420px** (**460px** for impact analysis).
- The main column always carries `minmax(0,1fr)` so long content cannot push
  the rail off-screen.

**Band, not rail, when the rail cannot fill the column.** A 320px rail is only
honest when its content is as tall as the main column. Answers and Decisions
were the worst instances of the opposite: Coverage plus an explainer is about
760px of card, the answer list is as long as the library is, and the rail simply
stopped — over 1,100px of empty right third on the default state alone. Nothing
could fill it, because there is no third thing those pages know.

So the supporting cards run **across the top** instead, on the same
`1fr / 320px` plumb line the rail used, and the content below gets the whole
container width:

    <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-5">  {/* the band */}
      <div className="min-w-0"><CoverageCard /></div>
      <div className="min-w-0"><HowServingWorks /></div>
    </div>
    <AnswersList />                                                {/* full width */}

This is a legitimate alternative to the rail, not a workaround: the plumb line
is unchanged, so nothing about the page's alignment moves. Choose it whenever a
rail's content is a fixed, short set of cards and the main column is an
unbounded list. Choose the rail when the rail's content genuinely scrolls with
the page (Audit's run history, Insights' evidence panels, a settings summary).

**Cards.** All cards in a column share the same left and right edge. Do not
wrap one card in an extra `max-w-[720px]` while its siblings run full width;
constrain the *column*, not individual cards.

**Dashboard grids.** Multi-widget pages (Overview, Insights) use
`grid grid-cols-3 gap-5` with widgets spanning columns as needed, so tile edges
line up both horizontally and vertically. Not a single stacked column.

**Card galleries.** Wrapping card collections (templates, connectors) use
`flex flex-wrap` with `flex-1 basis-*` cards, not a fixed column count, so
every row runs edge to edge. A short last row stretches its cards across the
full width; a dead bottom-right corner is a bug.

**Mobile.** Pages receive a `mobile` prop. Mobile collapses the grid to one
column and drops rails below the main content. Components themselves stay
desktop fixed-width (§10); mobile is composed at the page level.

## 12. Long text: truncate, don't pack

**Default to an ellipsis with the full value on hover.** Do not try to fit every
long string on screen by wrapping it.

The console is dense and largely tabular. Wrapping a long document title, URL,
API key, email, or claim reflows its row, breaks the alignment of every
neighbouring column, and in the worst case squeezes a column until it wraps one
character per line and grows a panel to thousands of pixels tall. An ellipsis
keeps the row one line tall, keeps every border plumb, and keeps the value
reachable.

Use `<Truncate>` / `<TruncateInline>` from `data-display/Truncate.tsx`:

    <Truncate>{doc.title}</Truncate>
    <Truncate as="td" lines={2}>{claim.text}</Truncate>

Rules:
- Any value that can be arbitrarily long (titles, URLs, tokens, keys, emails,
  file paths, claim text, owner names) truncates. The `title` attribute carries
  the full value, so it is available on hover and to assistive tech.
- The truncating element needs `min-w-0` on itself and on its flex/grid
  ancestors, or the ellipsis never engages and the text escapes instead.
- Prose blocks (a card's body paragraph, a summary) may wrap normally, and may
  use `lines={2}` or `lines={3}` to clamp.
- Reach for `[overflow-wrap:anywhere]` only where the full value genuinely must
  stay visible; it is the exception, not the default.
- Never widen a column, a card, or a page to accommodate a long value.

## 13. Toolbars, sort controls, and stats strips

- One standard selection/tab bar component everywhere. The Knowledge tab bar
  is the reference. No per-page variants (Answers must match Knowledge).
- The sort control sits on the same line as the section heading or toolbar.
  It never gets its own row and never overlaps content. If it cannot fit,
  collapse the label to just "Sort" and let the dropdown carry the options.
  Fix this in the component, not per page.
- Result-count / stats strips render **above** the list they describe and
  **below** the search/sort/filter bar. Never at the bottom of the results.
- Every control in a button group shares the same height. An H1 button in the
  editor toolbar is exactly as tall as Bold and Italic.

## 14. Tags on cards

- The tag block sits **bottom left** on every card, in the same position on
  every card. "Canonical", "Needs review", and "Decision chunk" all render in
  the same spot.
- Tag labels use sentence case, consistently. No mixed lowercase ("related"
  tags match the case of every other tag).
- When tags overflow, they stack, and the date/author line sits on the same
  line as the bottom tag row, never pushed below the whole stack.

## 15. Balanced siblings and empty states

- Sibling boxes in a row keep equal heights. Long content (a long task title)
  gets an expand affordance instead of growing its box.
- Empty-state boxes match the height of their populated siblings. "No results"
  and "No documents" render at the same height.
- Sibling sections share edges. A bottom section (Doc review change queue)
  runs the full page width under the side rail, not just the main column.

## 16. Repeated actions appear in the same place

- An action that appears on more than one pane appears in the same location
  every time. "Open in lineage" always sits directly below "View full
  history".
- "Open in lineage" has no leading icon.

## 17. Above the fold and mobile density

- Timeliest content first: Today's review sits above This week's digest.
- Stat tiles use compact padding so more content clears the fold.
- On mobile, long pages use collapsible sections. Forever scroll is a bug.
- Nothing ever overflows the viewport, in any state. Headers truncate with an
  ellipsis (§12); sections collapse when truncation is not enough.

## 18. Decorative art

- No watermark or background art may collide with content. The Refine panel
  branch art is removed, at the component level.

## 19. Content and interaction references (NN/g)

Copy and interaction patterns follow Nielsen Norman Group guidance:

- Headlines, page titles, microcontent: https://www.nngroup.com/articles/microcontent-how-to-write-headlines-page-titles-and-subject-lines/
- Headings: https://www.nngroup.com/articles/headings-pickup-lines/
- Link text: https://www.nngroup.com/articles/link-promise/
- Error messages: https://www.nngroup.com/articles/error-message-guidelines/
- Modes: https://www.nngroup.com/articles/modes/
- Confirmation dialogs: https://www.nngroup.com/articles/confirmation-dialog/
- Testing content: https://www.nngroup.com/articles/testing-content-websites/

## 20. Scrollable regions show a scroll indicator

Any component region that can scroll must show that it scrolls. macOS hides
scrollbars until the user is already scrolling, so a table cut off
mid-column or a list cut off mid-row reads as "that's all there is".

- Every scrollable region inside a component renders through
  `<Scrollable>` (`data-display/Scrollable.tsx`), never a bare
  `overflow-x-auto` / `overflow-y-auto` div.
- The indicator is the scrollbar itself, explicit and draggable, on both
  axes, visible whenever there is overflow. No gradient fades, no edge
  shadows, no arrows or chevrons. Never rely on the macOS overlay
  scrollbar that only appears mid-scroll; Scrollable styles a thin
  always-rendered bar.
- Content never crushes to make itself fit: a row of crumbs, steps, or
  tabs that cannot fit scrolls, it does not shrink each label to a
  letter.
- Match the fade to the surface: `fade="flysch"` inside code boxes and
  tinted panels, default paper elsewhere.
- Page-level scrolling (the app shell's main column, full-page auth
  shells) is the browser's own scroll and keeps the native scrollbar; the
  rule is about regions inside components.
