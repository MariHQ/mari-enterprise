# Console components

The Mari console component library — real, typechecked TypeScript/React source, one file per component, organized by type. This is the canonical copy; it originated as `mari-cc/console/src/saas/components/console-ui.tsx` (a monolithic file) and lives here now as the source of truth for the design system, independent of any one app's build.

Written to the same brand system as `../BRAND-STYLE-GUIDE.md` — read that first for the underlying tokens (colors, type, spacing, shape language) these components consume.

**Standalone reference, not a published/linked package.** Nothing currently imports this at build time — copy the file(s) you need into your app. `package.json` + `tsconfig.json` here exist only so the library typechecks on its own (`npm install && npx tsc -p tsconfig.json`), proving the code is real and correct, not just documentation.

## Index by type

| Type | Component | Source | Doc |
|---|---|---|---|
| Layout | [`Page.tsx`](./layout/Page.tsx) | Full-screen wrapper (kicker/title/subtitle/actions + body) | [Page.md](./layout/Page.md) |
| Layout | [`PageHeader.tsx`](./layout/PageHeader.tsx) | Header-only fragment, with back-link | [PageHeader.md](./layout/PageHeader.md) |
| Layout | [`Drawer.tsx`](./layout/Drawer.tsx) | Right-side slide-over, focus-trapped | [Drawer.md](./layout/Drawer.md) |
| Layout | [`Card.tsx`](./layout/Card.tsx) | Generic bordered content container | [Card.md](./layout/Card.md) |
| Layout | [`Dialog.tsx`](./layout/Dialog.tsx) | Centered modal (Radix-based) | [Dialog.md](./layout/Dialog.md) |
| Layout | [`Separator.tsx`](./layout/Separator.tsx) | Hairline divider (Radix-based) | [Separator.md](./layout/Separator.md) |
| Forms | [`Field.tsx`](./forms/Field.tsx) | Labeled read-only key/value row | [Field.md](./forms/Field.md) |
| Forms | [`FormField.tsx`](./forms/FormField.tsx) | Labeled editable-form row | [FormField.md](./forms/FormField.md) |
| Forms | [`SectionLabel.tsx`](./forms/SectionLabel.tsx) | The uppercase mono label, standalone | [SectionLabel.md](./forms/SectionLabel.md) |
| Forms | [`Input.tsx`](./forms/Input.tsx), [`Select.tsx`](./forms/Select.tsx), [`Textarea.tsx`](./forms/Textarea.tsx) | Styled native form controls | [Input.md](./forms/Input.md) |
| Forms | [`Switch.tsx`](./forms/Switch.tsx) | Toggle (Radix-based) | [Switch.md](./forms/Switch.md) |
| Forms | [`Checkbox.tsx`](./forms/Checkbox.tsx) | Checkbox, incl. indeterminate (Radix-based) | [Checkbox.md](./forms/Checkbox.md) |
| Forms | [`RadioGroup.tsx`](./forms/RadioGroup.tsx) | Standalone radio group (Radix-based) | [RadioGroup.md](./forms/RadioGroup.md) |
| Forms | [`Combobox.tsx`](./forms/Combobox.tsx) | Searchable select | [Combobox.md](./forms/Combobox.md) |
| Forms | [`TagInput.tsx`](./forms/TagInput.tsx) | Editable multi-value chip input | [TagInput.md](./forms/TagInput.md) |
| Actions | [`buttons.ts`](./actions/buttons.ts) | `btn` / `btnPrimary` / `btnDanger` class strings | [Buttons.md](./actions/Buttons.md) |
| Actions | [`Button.tsx`](./actions/Button.tsx) | Full button component, 5 variants | [Button.md](./actions/Button.md) |
| Actions | [`ConfirmButton.tsx`](./actions/ConfirmButton.tsx) | Two-step destructive confirm | [ConfirmButton.md](./actions/ConfirmButton.md) |
| Actions | [`Toggle.tsx`](./actions/Toggle.tsx) | Toggle + ToggleGroup (Radix-based) | [Toggle.md](./actions/Toggle.md) |
| Data display | [`Badge.tsx`](./data-display/Badge.tsx) | 5-tone status pill | [Badge.md](./data-display/Badge.md) |
| Data display | [`Chip.tsx`](./data-display/Chip.tsx) | Interactive chip + Status/Severity/Count wrappers | [Chip.md](./data-display/Chip.md) |
| Data display | [`Table.tsx`](./data-display/Table.tsx) | Static table shell | [Table.md](./data-display/Table.md) |
| Data display | [`DataTable.tsx`](./data-display/DataTable.tsx) | Search/sort/filter/paginate table | [DataTable.md](./data-display/DataTable.md) |
| Data display | [`EmptyState.tsx`](./data-display/EmptyState.tsx) | Centered empty-panel state | [EmptyState.md](./data-display/EmptyState.md) |
| Data display | [`Spinner.tsx`](./data-display/Spinner.tsx) | Loading indicator, two sizes | [Spinner.md](./data-display/Spinner.md) |
| Data display | [`Skeleton.tsx`](./data-display/Skeleton.tsx) | Loading-placeholder block | [Skeleton.md](./data-display/Skeleton.md) |
| Data display | [`Progress.tsx`](./data-display/Progress.tsx) | Determinate linear progress (Radix-based) | [Progress.md](./data-display/Progress.md) |
| Data display | [`Pagination.tsx`](./data-display/Pagination.tsx) | Standalone pager | [Pagination.md](./data-display/Pagination.md) |
| Data display | [`Stepper.tsx`](./data-display/Stepper.tsx) | Numbered step progress | [Stepper.md](./data-display/Stepper.md) |
| Data display | [`Stat.tsx`](./data-display/Stat.tsx) | Big-number stat card | [Stat.md](./data-display/Stat.md) |
| Data display | [`IconRing.tsx`](./data-display/IconRing.tsx) | Circle around an icon | [IconRing.md](./data-display/IconRing.md) |
| Data display | [`Avatar.tsx`](./data-display/Avatar.tsx) | Initials disc, one flat treatment | [Avatar.md](./data-display/Avatar.md) |
| Data display | [`Swatch.tsx`](./data-display/Swatch.tsx) | Color chip | [Swatch.md](./data-display/Swatch.md) |
| Data display | [`Sparkline.tsx`](./data-display/Sparkline.tsx) | Inline SVG trend line | [Sparkline.md](./data-display/Sparkline.md) |
| Data display | [`Accordion.tsx`](./data-display/Accordion.tsx) | Disclosure sections (Radix-based) | [Accordion.md](./data-display/Accordion.md) |
| Data display | [`ActivityFeed.tsx`](./data-display/ActivityFeed.tsx) | Chronological event timeline | [ActivityFeed.md](./data-display/ActivityFeed.md) |
| Data display | [`TreeView.tsx`](./data-display/TreeView.tsx) | Hierarchical disclosure list | [TreeView.md](./data-display/TreeView.md) |
| Navigation | [`Tabs.tsx`](./navigation/Tabs.tsx) | Accessible tab switcher (Radix-based) | [Tabs.md](./navigation/Tabs.md) |
| Navigation | [`Menu.tsx`](./navigation/Menu.tsx) | Dropdown menu + items (Radix-based) | [Menu.md](./navigation/Menu.md) |
| Navigation | [`Popover.tsx`](./navigation/Popover.tsx) | Click-open content panel (Radix-based) | [Popover.md](./navigation/Popover.md) |
| Navigation | [`Tooltip.tsx`](./navigation/Tooltip.tsx) | Hover/focus hint (Radix-based) | [Tooltip.md](./navigation/Tooltip.md) |
| Navigation | [`Breadcrumb.tsx`](./navigation/Breadcrumb.tsx) | Multi-level trail | [Breadcrumb.md](./navigation/Breadcrumb.md) |
| Navigation | [`NotificationBell.tsx`](./navigation/NotificationBell.tsx) | Topbar bell + panel (Radix-based) | [NotificationBell.md](./navigation/NotificationBell.md) |
| Navigation | [`ContextMenu.tsx`](./navigation/ContextMenu.tsx) | Right-click menu (Radix-based) | [ContextMenu.md](./navigation/ContextMenu.md) |
| Feedback | [`Toast.tsx`](./feedback/Toast.tsx) | Global transient notifications (Radix-based) | [Toast.md](./feedback/Toast.md) |
| Feedback | [`Alert.tsx`](./feedback/Alert.tsx) | Persistent inline banner | [Alert.md](./feedback/Alert.md) |
| Tokens | [`card.ts`](./tokens/card.ts), [`focusRing.ts`](./tokens/focusRing.ts), [`format.ts`](./tokens/format.ts) | Shared style-string tokens + date formatting | [shared-tokens.md](./tokens/shared-tokens.md) |

`index.ts` re-exports everything as one barrel. Full parity with `cloud.mari.guru`'s design-system surface (`mari/mari/web/src/components/ui`) plus a second gap-fill pass benchmarked against a mature component library (shadcn/ui — same Radix+Tailwind architecture — cross-checked against Ant Design/Carbon/Polaris for admin-console patterns). `NotificationBell` and `ActivityFeed` aren't speculative additions — they're grounded in real files in the actual product mockup (`NotificationsBell.tsx`/`NotificationsPanel.tsx`, `LiveActivityFeed.tsx`/`AuditActivityFeed.tsx` all exist in `mari/web/web/src/saas/components`).

## Where new components come from

**`mari/web/web/src/saas/components/console-ui.tsx`** is the real, already-designed Brutalist Blueprint console primitives file (`Page`, `Avatar`, `Badge`, `Table`, `btn`/`btnPrimary`/`btnDanger`, `DataTable`, `Drawer`, `Field` — the same 8 this library started from). **Check there first** before designing a new component — if it already exists, port it faithfully; don't redesign it.

**`cloud.mari.guru`** (`mari/mari/web/src/components/ui`) is useful for exactly one thing: a checklist of *which* components a full console needs (its production surface is broader than `console-ui.tsx`'s 8). It is **not** a design or API source — it's the pre-reskin production app, still on the deprecated cream/serif "Editorial Notebook" theme, built with a different styling methodology (`clsx` + BEM classes against a separate stylesheet) and its own one-off product decisions (e.g. its `PageHeader` defaults to a hand-drawn plant `Sprig` icon; its `Avatar` tints per person by name-hash). Copying its prop shapes, defaults, or behavior wholesale carries those decisions in without anyone deciding they belong here. `Avatar` briefly did exactly this (a name-hash 4-color tint) before being caught against `console-ui.tsx`'s real, deliberately-flat implementation — see `Avatar.md`'s notes.

For anything past those 8 (no `console-ui.tsx` precedent exists yet), design from **BRAND-STYLE-GUIDE.md's rules plus this library's own established patterns** (`card`, `focusRing`, the `TONE` 5-scale, `thClass`, `DataTable`'s search/select treatment) — using `cloud.mari.guru` only to know the component needs to exist at all, never for how it should look or behave.

## Conventions every component follows

- **Tailwind utility classes**, not CSS modules or styled-components — every component reads brand tokens directly as Tailwind classes (`bg-paper`, `text-ink/60`, `border-ink/15`). Your consuming app needs the same Tailwind config as `mari-cc/console` (the `ink`/`paper`/`biscay`/`flysch`/`espelette`/`moss`/`clay` color tokens, `font-display`/`font-term` families) for these to render correctly — see `../BRAND-STYLE-GUIDE.md` §1–2 for the exact values.
- **App/console shape rules** (BRAND-STYLE-GUIDE.md §3): 4–6px radius, no shadows, hairline `ink/15` borders for separation. This is console-mode styling, not marketing/brand-mode — don't reach for the hard block shadow here.
- **`focusRing`** is applied to every interactive element without exception — a keyboard-accessibility floor, not optional polish.
- **JetBrains Mono (`font-term`)** for chrome: table headers, badges, counts, uppercase labels. Never for body text.
- **No `clsx`** — conditional classes are composed as plain template literals / `filter(Boolean).join(" ")`, matching the rest of the library. Most of the interactive components are exceptions on the *dependency* side only (each needs its matching `@radix-ui/react-*` package for real keyboard/ARIA behavior) — `Tabs`, `Menu`, `Popover`, `Tooltip`, `Switch`, `Toaster`, `Dialog`, `Separator`, `Checkbox`, `RadioGroup`, `Progress`, `Accordion`, `ContextMenu`, `Toggle`/`ToggleGroup`. `GlobalSearch` and `Combobox` are the two exceptions with no Radix primitive to wrap — there's no Radix combobox/command primitive, so both hand-roll a listbox on top of `@radix-ui/react-dialog`/`@radix-ui/react-popover`. All Radix packages used here are already present in both `mari-cc/console` and `mari/web`'s dependency trees.

## Keeping this in sync

If `mari-cc/console` changes these components, this library goes stale until someone ports the change back here (and vice versa — this is the canonical copy now, so **new component work should start here**, not in an app repo).
