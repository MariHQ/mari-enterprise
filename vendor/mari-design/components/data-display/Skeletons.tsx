import type { ReactNode } from "react";
import {
  Skeleton, SkeletonLine, SkeletonText, SkeletonCircle, SkeletonChip, SkeletonButton,
  SkeletonCard, SkeletonStat, SkeletonList, SkeletonRows, SkeletonRegion,
} from "./Skeleton";
import { SortHeader } from "./sortable";
import { Button } from "../actions/Button";
import { IconSearch } from "../icons/ui";
import { PageHeader } from "../layout/PageHeader";
import { PAGE_CONTAINER, SPLIT, DASH3 } from "../tokens/pagegrid";

/* Full-page loading skeletons that mirror each page archetype's real layout,
   so the loading state reads as "the page, arriving" rather than a spinner.

   TWO THINGS THIS FILE GETS RIGHT THAT IT USED TO GET WRONG.

   1. It shows what it knows. A page's eyebrow, title, description, tab strip,
      section headings and column headers are literals in the page file — the
      app holds all of them at first paint. Drawing them as grey rectangles
      threw away information the reader could already be reading, made all 23
      loading screens identical and unplaceable, and relaid the page out when
      real words swapped in at a different width. So the caller passes the
      strings it has, and only the VALUES the response owes (counts, names,
      dates, rows, chart series) are bars. A page whose title comes from the
      response (a document's name in Doc Review) passes none and gets a bar —
      inventing a title would be worse than a grey box.

   2. It occupies the loaded page's geometry (DD-39). This used to be
      `max-w-6xl` with its own `sm:grid-cols-2` / `lg:grid-cols-[1fr_320px]`
      stacking while §11 mandates `max-w-[1400px]` and §10 forbids that
      stacking, so every page loaded at one width and settled at another. It
      now sits in PAGE_CONTAINER and uses the same SPLIT / DASH3 recipes the
      pages themselves use — one source of truth, in tokens/pagegrid.ts.

   Pages pick a `variant` matching their content. */

export type SkeletonPageVariant =
  | "dashboard" | "list" | "table" | "detail" | "editor"
  | "graph" | "form" | "board" | "gallery" | "settings" | "feed" | "auth";

/** One header button in a loading state: its real label, and its real variant
    when it is the page's primary action. See `actions` below for the rule. */
export type SkeletonAction = string | { label: string; variant?: "default" | "primary" | "danger" };

export type SkeletonPageProps = {
  variant?: SkeletonPageVariant;
  /** Real header copy, exactly as the loaded page's `<PageHeader>` spells it.
      Omit any part that is derived from the response. */
  eyebrow?: string;
  title?: string;
  description?: string;
  icon?: ReactNode;
  /** What to announce as loading, when the page's own title is data and so
      cannot be shown ("Doc Review", "sign in"). Defaults to `title`. */
  label?: string;
  /** Real tab labels and which one is on. */
  tabs?: string[];
  activeTab?: string;
  /** Real headings of the main column's sections, in order. */
  sections?: string[];
  /** Real headings of the supporting rail's sections, in order. */
  rail?: string[];
  /** Where the supporting cards sit, matching the two shapes §11 allows.
   *
   *  `"beside"` (default) is the 320px right rail: `1fr / 320px`, rail beside
   *  the main column.
   *
   *  `"above"` is the BAND — the same `1fr / 320px` plumb line, run across the
   *  top, with the main content full width below it. Answers and Decisions
   *  moved to it because their supporting cards are a fixed ~760px of content
   *  beside a list as long as the library is, and a rail there is a thousand
   *  pixels of dead right third. A skeleton that draws a rail for a page that
   *  renders a band is the same lie in reverse: it claims a column the load
   *  then throws away, and puts the list in 1fr when the list gets the whole
   *  width. */
  railPlacement?: "beside" | "above";
  /** Real column headers for the table variants. */
  columns?: string[];
  /** Real stat-tile captions for a dashboard's stat row. */
  stats?: string[];
  /** Real field labels for a form / auth card. */
  fields?: string[];
  /** The page's own search box, given as its real placeholder ("Search
      knowledge…"). Same rule as `actions`: a placeholder is chrome the page
      file spells out, so it renders, in a real input that is disabled until
      there is an index to search. Omit on pages that have no search box. */
  search?: string;
  /** The loaded header's action buttons.
   *
   *  THE RULE FOR A BUTTON IN A LOADING STATE (settled here, applied
   *  everywhere): render the real control, with its real label, DISABLED.
   *
   *  Both of the old answers were wrong. A grey pill throws away a label the
   *  page file holds as a literal — "New fact" is chrome, not a value the
   *  response owes — and it is the exact bug the rest of this file exists to
   *  remove. A live-looking button that ignores the click is worse: it claims
   *  an affordance the page cannot honour (§2). `disabled` is the honest third
   *  option. It is the truth (there is nothing to act on yet), the platform
   *  enforces it rather than the page pretending, assistive tech announces it,
   *  and the button occupies the width it will occupy when it wakes up, so
   *  nothing moves on load.
   *
   *  Pass the labels, in the loaded header's order, primary last:
   *      actions={["Harvest questions", { label: "New answer", variant: "primary" }]}
   *  A bare number stays supported for the one case the rule allows — a header
   *  whose buttons are themselves data (a per-connector action) — and for
   *  pages not yet migrated. It draws bars, as before. `0` draws nothing. */
  actions?: number | SkeletonAction[];
  /** Page-level mobile (§10/§11): the page owns the collapse, not the
      components. Rails drop below the main column. */
  mobile?: boolean;
  className?: string;
};

/* The header's action row, under the rule documented on `actions`.

   Labels given: the real buttons, disabled. No labels, just a count: bars, the
   pre-migration fallback. Either way the row is the same height and sits in
   the same slot, so the header does not reflow when the page wakes up. */
function HeadActions({ actions }: { actions: number | SkeletonAction[] }) {
  if (Array.isArray(actions)) {
    if (!actions.length) return null;
    return (
      <>
        {actions.map((a, i) => {
          const { label, variant } = typeof a === "string" ? { label: a, variant: undefined } : a;
          return (
            /* `disabled`, not `aria-disabled`: the control must actually
               refuse the click, not merely say it would. */
            <Button key={label + i} variant={variant} disabled>{label}</Button>
          );
        })}
      </>
    );
  }
  if (actions <= 0) return null;
  return <>{Array.from({ length: actions }).map((_, i) => <SkeletonButton key={i} w={i === 0 ? 110 : 84} />)}</>;
}

function hasActions(actions: number | SkeletonAction[]): boolean {
  return Array.isArray(actions) ? actions.length > 0 : actions > 0;
}

/* The header when the page's own title is data (Doc Review, a Publish site):
   bars, at PageHeader's heights, so nothing is claimed and nothing jumps. The
   ACTIONS are not data, so they follow the same rule as everywhere else. */
function HeadBars({ actions = 2 }: { actions?: number | SkeletonAction[] }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-3">
      <div className="min-w-[15rem] flex-1 space-y-2.5">
        <Skeleton width="min(230px, 70%)" height={22} />
        <SkeletonLine w="min(340px, 95%)" h={13} />
      </div>
      {hasActions(actions) && (
        <div className="flex flex-wrap items-center gap-2"><HeadActions actions={actions} /></div>
      )}
    </header>
  );
}

function Head({ eyebrow, title, description, icon, actions = 2 }: SkeletonPageProps) {
  if (!title) return <HeadBars actions={actions} />;
  return (
    <PageHeader
      eyebrow={eyebrow}
      title={title}
      description={description}
      icon={icon}
      actions={hasActions(actions) ? <HeadActions actions={actions} /> : undefined}
    />
  );
}

/* The tab strip, real. Underline `Tabs` geometry (13px medium, gap-5,
   border-b-2, pb-2) so the row does not move when the page becomes
   interactive. Rendered as text rather than buttons: a tab that cannot switch
   yet is a label, and a button that ignores the click is a lie (§2). */
function TabStrip({ tabs, active }: { tabs?: string[]; active?: string }) {
  if (!tabs?.length) return null;
  const on = active ?? tabs[0];
  return (
    <div className="flex max-w-full items-center gap-5 overflow-hidden border-b border-ink/15">
      {tabs.map((t) => (
        <span
          key={t}
          className={`inline-flex shrink-0 items-center whitespace-nowrap border-b-2 pb-2 text-[13px] font-medium ${
            t === on ? "border-biscay-2 text-ink" : "border-transparent text-ink/70"
          }`}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

/** A card standing in for one titled section. Real heading, skeleton body. */
function Section({ title, lines = 4, media = false, footer = false }: { title?: string; lines?: number; media?: boolean; footer?: boolean }) {
  return <SkeletonCard title={title} lines={lines} media={media} footer={footer} className="min-w-0" />;
}

function Sections({ titles, count = 2, lines = 4 }: { titles?: string[]; count?: number; lines?: number }) {
  const list = titles?.length ? titles : Array.from({ length: count }, () => undefined);
  return <>{list.map((t, i) => <Section key={t ?? i} title={t} lines={lines} />)}</>;
}

/** The stat row a page opens with. Rendered only when the caller says the
    loaded page HAS one and how many tiles it has: a page that opens with three
    stats and loads under a skeleton drawing four jumps its whole body when the
    row rewraps, and a page with no stat row at all should not grow one. */
function StatRow({ stats }: { stats?: string[] }) {
  if (!stats?.length) return null;
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
      {stats.map((s, i) => <SkeletonStat key={s || i} label={s || undefined} />)}
    </div>
  );
}

/** Main column beside a supporting rail, collapsing to one column when the
    caller has no rail — so a page WITHOUT a rail is not given an empty 320px
    of dead space, and a page with one does not have its rail content dumped
    into the main column. */
function Split({
  rail, mobile, width = 320, placement = "beside", children,
}: {
  rail?: string[]; mobile?: boolean; width?: 320 | 360;
  placement?: "beside" | "above"; children: ReactNode;
}) {
  if (!rail?.length) return <div className="flex min-w-0 flex-col gap-5">{children}</div>;
  const cards = <Sections titles={rail} lines={4} />;
  /* The band: same plumb line, run across the top, main content full width
     below (§11). Mobile is identical either way — a rail and a band both
     collapse to one column, in the order the page draws them. */
  if (placement === "above") {
    return (
      <div className="flex min-w-0 flex-col gap-5">
        <div className={mobile ? "flex flex-col gap-5" : SPLIT[width]}>{cards}</div>
        {children}
      </div>
    );
  }
  return (
    <div className={mobile ? "flex flex-col gap-5" : SPLIT[width]}>
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
      <div className="flex min-w-0 flex-col gap-5">{cards}</div>
    </div>
  );
}

/** A table with its real column headers and skeleton cells. */
function TableBlock({ columns, cols = 5, rows = 8 }: { columns?: string[]; cols?: number; rows?: number }) {
  const heads = columns?.length ? columns : Array.from({ length: cols }, () => null);
  return (
    <div className="overflow-hidden rounded-md border border-ink/12 bg-paper">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            {heads.map((label, i) => (
              <SortHeader key={i} label={label ?? <SkeletonLine w={70} h={9} />} sortable={false} />
            ))}
          </tr>
        </thead>
        <tbody><SkeletonRows rows={rows} cols={heads.length} /></tbody>
      </table>
    </div>
  );
}

/** The page's own search box: real placeholder, real input box, disabled.
    `SearchInput`'s geometry (h-9, rounded-[4px], 13px) so it does not resize
    when it becomes typeable. */
function SearchBox({ placeholder, width = 340 }: { placeholder: string; width?: number | string }) {
  return (
    <div
      className="flex h-9 shrink-0 items-center gap-2 rounded-[4px] border border-ink/20 bg-paper px-2.5"
      style={{ width, maxWidth: "100%" }}
    >
      <IconSearch size={14} className="shrink-0 text-ink/45" />
      <input
        disabled
        readOnly
        value=""
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink/65"
      />
    </div>
  );
}

/** Facets on the left, search on the right: the toolbar chrome above a table
    or list (§13), in the order the loaded pages draw it (Facts, Library). The
    facet labels ARE per-workspace data (source names, statuses, counts), so
    they stay chips; the search box is chrome and renders as itself. */
function Toolbar({ search }: { search?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SkeletonChip w={90} /><SkeletonChip w={90} /><SkeletonChip w={72} />
      <span className="ml-auto">
        {search ? <SearchBox placeholder={search} /> : <Skeleton width={240} height={36} rounded="rounded-[4px]" />}
      </span>
    </div>
  );
}

/** Labelled form fields. The labels are the form's own copy, so they render;
    only the inputs' contents are unknown. */
function Fields({ fields, count = 5 }: { fields?: string[]; count?: number }) {
  const list = fields?.length ? fields : Array.from({ length: count }, () => undefined);
  return (
    <>
      {list.map((label, i) => (
        <div key={label ?? i} className="space-y-1.5">
          {label != null
            ? <span className="block text-[12.5px] font-medium text-ink/70">{label}</span>
            : <SkeletonLine w={120} h={12} />}
          <Skeleton height={38} rounded="rounded-[4px]" />
        </div>
      ))}
    </>
  );
}

export function SkeletonPage(props: SkeletonPageProps) {
  const {
    variant = "dashboard", tabs, activeTab, sections, rail, columns, stats, fields, search,
    railPlacement = "beside", title, label, mobile = false, className = "",
  } = props;

  /* A page that runs its supporting cards as a BAND draws them between the
     stat row and the tab strip, with everything below at full width — that is
     the whole point of the shape, and it is a different vertical order from
     the rail, not just a different column. Its filters are the tabs, so there
     is no chip row either. */
  const band = railPlacement === "above" && rail?.length ? rail : undefined;
  const bandBlock = band ? (
    <div className={mobile ? "flex flex-col gap-5" : SPLIT[320]}><Sections titles={band} lines={4} /></div>
  ) : null;

  /* Auth shells own the whole viewport rather than the console grid: no
     sidebar, no page container. Login/Setup/Welcome know their own headline
     and field labels, so the card is legible before the session resolves. */
  if (variant === "auth") {
    return (
      <SkeletonRegion
        label={label ?? title ?? "sign in"}
        className={`grid min-h-[600px] place-items-center px-6 ${className}`.trim()}
      >
        <div className="w-full max-w-sm rounded-xl border border-ink/12 bg-paper p-8 shadow-sm">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <SkeletonCircle size={44} />
            {title
              ? <h1 className="text-[20px] font-bold leading-tight tracking-[-0.015em] text-ink">{title}</h1>
              : <SkeletonLine w={160} h={20} />}
            {props.description
              ? <p className="text-[13px] text-ink/70">{props.description}</p>
              : <SkeletonLine w={220} h={13} />}
          </div>
          <div className="space-y-4">
            <Fields fields={fields} count={2} />
            <Skeleton height={38} rounded="rounded-[4px]" className="mt-2" />
          </div>
        </div>
      </SkeletonRegion>
    );
  }

  const railCol = mobile ? "min-w-0" : "min-w-0";

  const inner = (() => {
    switch (variant) {
      case "dashboard":
        /* Overview / Insights: a stat row over a three-up widget grid (§11
           dashboard grid), not the old two-column `lg:grid-cols-2` stack. */
        return (
          <>
            <Head {...props} />
            <div className="mt-6 flex flex-col gap-5">
              {/* The COUNT of tiles is page chrome even when the captions are
                  not: a dashboard knows how many stats it draws. Pass `stats`
                  (empty strings for captions that really are data) and the row
                  stops resizing on load. Four is only the pre-migration
                  fallback. */}
              <StatRow stats={stats?.length ? stats : ["", "", "", ""]} />
              <div className={mobile ? "flex flex-col gap-5" : DASH3}>
                <Sections titles={sections} count={3} lines={5} />
              </div>
            </div>
          </>
        );

      case "list":
        /* Answers / Audit / Flows / Library.
           This used to render exactly one shape — chips over a flat row list —
           and to DROP `sections` and `rail` on the floor, which is why Audit
           passed two real section headings and still came up as an anonymous
           grey list. Every part is now driven by what the caller passed, so
           four pages that look nothing alike stop loading as the same screen:

             stats    -> the stat row the page opens with (Answers, Library)
             sections -> the named cards down the main column (Audit's five
                         finding groups, Flows' template cards)
             rail     -> the supporting rail beside them (Audit's history)

           Only the FILTER CHIPS stay bars: their labels are per-workspace data
           (source names, statuses, counts), not page chrome. */
        return (
          <>
            <Head {...props} />
            <div className="mt-6 flex flex-col gap-5">
              {band ? (
                <>
                  <StatRow stats={stats} />
                  {bandBlock}
                  <TabStrip tabs={tabs} active={activeTab} />
                  {sections?.length
                    ? <Sections titles={sections} lines={4} />
                    : <SkeletonList rows={7} />}
                </>
              ) : (
                <>
                  <TabStrip tabs={tabs} active={activeTab} />
                  <StatRow stats={stats} />
                  <div className="flex flex-wrap items-center gap-2">
                    <SkeletonChip w={72} /><SkeletonChip w={64} /><SkeletonChip w={88} />
                    {search && <span className="ml-auto"><SearchBox placeholder={search} /></span>}
                  </div>
                  <Split rail={rail} mobile={mobile} width={320}>
                    {sections?.length
                      ? <Sections titles={sections} lines={4} />
                      : <SkeletonList rows={7} />}
                  </Split>
                </>
              )}
            </div>
          </>
        );

      case "feed":
        return (
          <>
            <Head {...props} />
            <div className="mt-6 flex flex-col gap-5">
              <TabStrip tabs={tabs} active={activeTab} />
              <SkeletonList rows={8} />
            </div>
          </>
        );

      case "table":
        /* Facts, and any page whose body is one table. `tabs` are the real
           filter tabs, `columns` the real head, `search` the real placeholder;
           `sections` are the further named cards under the table (Facts'
           "Verification audit"). */
        return (
          <>
            <Head {...props} />
            <div className="mt-6 flex flex-col gap-5">
              <TabStrip tabs={tabs} active={activeTab} />
              {/* Only pages that HAVE a toolbar get one. It used to be
                  unconditional, so Publish — a tab strip straight onto a table
                  of doc sites — loaded under three facet chips and a search box
                  it does not own, then settled with the table 50px higher.
                  `search` is the signal: the toolbar is a facet row plus the
                  page's own search box, and a page with neither does not
                  declare one. */}
              {search && <Toolbar search={search} />}
              <Split rail={rail} mobile={mobile}>
                <TableBlock columns={columns} />
                {sections?.length ? <Sections titles={sections} lines={4} /> : null}
              </Split>
            </div>
          </>
        );

      case "detail":
        /* Knowledge: THREE columns, matching `KnowledgeBrowser`'s own grid — a
           220px facet rail, the results feed (search box on top), and the
           360px inspector (§11). It used to be a 2x2 card grid, which is not
           a narrower version of this page, it is a different page: the
           skeleton claimed a layout the load then threw away. The facet rail's
           group labels are per-workspace data, so they stay bars; the search
           placeholder is chrome and renders. */
        return (
          <>
            <Head {...props} />
            <div className={mobile ? "mt-6 flex flex-col gap-5" : `mt-6 ${SPLIT[360]}`}>
              <div className={mobile
                ? "flex min-w-0 flex-col gap-4"
                : "grid min-w-0 items-start gap-4 grid-cols-[minmax(0,220px)_minmax(0,1fr)]"}>
                <div className="flex min-w-0 flex-col gap-4 rounded-md border border-ink/12 bg-paper p-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <SkeletonLine w="50%" h={9} />
                      <SkeletonLine w="82%" /><SkeletonLine w="66%" /><SkeletonLine w="74%" />
                    </div>
                  ))}
                </div>
                <div className="flex min-w-0 flex-col gap-3">
                  {search
                    ? <SearchBox placeholder={search} width="100%" />
                    : <Skeleton height={36} rounded="rounded-md" />}
                  <SkeletonLine w={120} h={10} />
                  <SkeletonList rows={5} />
                </div>
              </div>
              <div className={`flex flex-col gap-5 ${railCol}`}>
                <Sections titles={rail} count={1} lines={6} />
              </div>
            </div>
          </>
        );

      case "editor":
        /* Doc Review: the document, and ONE 320px rail on its right carrying
           every panel (outline, revision history, refine). It used to draw a
           third column, 220px wide, on the LEFT — a rail the loaded page does
           not have, on the side it is not on, narrow enough to clip its own
           heading to "Document outl…". So the panel headings the caller passes
           now all land in the right rail, in order, and `sections` are the
           full-width blocks BELOW the document (Doc Review's change queue).
           With no rail passed the document runs full width rather than sitting
           in a column with 320px of dead air beside it. */
        return (
          <>
            <Head {...props} />
            <div className="mt-6 flex flex-col gap-5">
              <TabStrip tabs={tabs} active={activeTab} />
              <Split rail={rail} mobile={mobile}>
                <div className="min-w-0 rounded-md border border-ink/12 bg-paper p-6">
                  <SkeletonLine w="55%" h={20} />
                  <SkeletonText lines={5} className="mt-4" />
                  <SkeletonText lines={4} className="mt-4" />
                  <SkeletonText lines={6} className="mt-4" />
                </div>
              </Split>
              {sections?.length ? <Sections titles={sections} lines={5} /> : null}
            </div>
          </>
        );

      case "graph":
        /* Lineage: toolbar, canvas, time scrubber. The canvas is the one place
           a full grey block is honest — every pixel of it is the response. */
        return (
          <>
            <Head {...props} />
            <div className="mt-6 flex flex-col gap-5">
              <Toolbar search={search} />
              <Skeleton height={440} className="rounded-md" />
              <Skeleton height={54} className="rounded-md" />
            </div>
          </>
        );

      case "form":
      case "settings":
        /* Settings pages: header, the real Settings tab row, then the main
           column beside a summary rail (§11, 320px).

           Only HALF of Settings is a form. General and Preferences edit
           fields; Members, API keys and the access log are tables. Drawing a
           five-field form for all of them is how Members came up as a stack of
           input boxes and settled as a member table. So the main card follows
           what the caller passed: `fields` means a form, `columns` means a
           table with its real head, and NEITHER means a plain card. Five grey
           input boxes are themselves a claim — "this page is a form with five
           fields" — and a page that has not said so should not make it. */
        return (
          <>
            <Head {...props} />
            <div className="mt-5"><TabStrip tabs={tabs} active={activeTab} /></div>
            <div className={mobile ? "mt-6 flex flex-col gap-5" : `mt-6 ${SPLIT[320]}`}>
              <div className="flex min-w-0 flex-col gap-5">
                {fields?.length ? (
                  <div className="rounded-md border border-ink/12 bg-paper">
                    <div className="px-4 pt-4 pb-3">
                      {sections?.[0] != null
                        ? <h2 className="truncate text-[15px] font-semibold leading-snug text-ink">{sections[0]}</h2>
                        : <SkeletonLine w="38%" h={15} />}
                    </div>
                    <div className="flex flex-col gap-4 px-4 pb-4">
                      <Fields fields={fields} />
                      {/* The form's own controls, spelled: every settings form
                          in the console saves with these two words. */}
                      <div className="flex gap-2 pt-1">
                        <Button variant="primary" disabled>Save changes</Button>
                        <Button disabled>Cancel</Button>
                      </div>
                    </div>
                  </div>
                ) : columns?.length ? (
                  <div className="overflow-hidden rounded-md border border-ink/12 bg-paper">
                    {sections?.[0] != null && (
                      <div className="px-4 pt-4 pb-3">
                        <h2 className="truncate text-[15px] font-semibold leading-snug text-ink">{sections[0]}</h2>
                      </div>
                    )}
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr>
                          {columns.map((label, i) => <SortHeader key={i} label={label} sortable={false} />)}
                        </tr>
                      </thead>
                      <tbody><SkeletonRows rows={6} cols={columns.length} /></tbody>
                    </table>
                  </div>
                ) : (
                  <Section title={sections?.[0]} lines={8} />
                )}
                {sections && sections.length > 1 && <Sections titles={sections.slice(1)} lines={4} />}
              </div>
              <div className={`flex flex-col gap-5 ${railCol}`}>
                <Sections titles={rail} count={1} lines={4} />
              </div>
            </div>
          </>
        );

      case "board":
        /* Tasks: the column names ARE the workflow ("Inbox", "In progress",
           "Done") and never come from the response. They render. */
        return (
          <>
            <Head {...props} />
            <div className={mobile ? "mt-6 flex flex-col gap-5" : `mt-6 ${DASH3}`}>
              {(sections?.length ? sections : [undefined, undefined, undefined]).map((s, i) => (
                <div key={s ?? i} className="flex min-w-0 flex-col gap-3">
                  {s != null
                    ? <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink/70">{s}</h2>
                    : <SkeletonLine w="40%" h={13} />}
                  <SkeletonCard lines={2} /><SkeletonCard lines={3} /><SkeletonCard lines={2} />
                </div>
              ))}
            </div>
          </>
        );

      case "gallery":
        /* Sources / Lookbook: a wrapping card gallery that runs edge to edge
           (§11), not a fixed three-column grid with a dead bottom-right. */
        return (
          <>
            <Head {...props} />
            <div className="mt-6 flex flex-col gap-5">
              <TabStrip tabs={tabs} active={activeTab} />
              <div className="flex flex-wrap gap-5">
                {(sections?.length ? sections : Array.from({ length: 6 }, () => undefined)).map((s, i) => (
                  <div key={s ?? i} className="min-w-[260px] flex-1 basis-[300px]">
                    <Section title={s} lines={2} media />
                  </div>
                ))}
              </div>
            </div>
          </>
        );
    }
  })();

  return (
    <SkeletonRegion label={label ?? title ?? "page"} className={`${PAGE_CONTAINER} ${className}`.trim()}>
      {inner}
    </SkeletonRegion>
  );
}
