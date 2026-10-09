import { useState } from "react";
import type { PageModule, PageProps } from "./types";
import { PageFrame, navFor } from "./PageFrame";
import { BookOpen } from "lucide-react";
import { PageHeader } from "../layout/PageHeader";
import { Card } from "../layout/Card";
import { Button } from "../actions/Button";
import { Tabs, type TabOption } from "../navigation/Tabs";
import { SearchField } from "../navigation/SearchField";
import { EmptyState } from "../data-display/EmptyState";
import { ResultCount } from "../data-display/Pagination";
import { SkeletonPage } from "../data-display/Skeletons";
import { ReadError } from "../feedback/ReadError";
import { LibraryTagsPanel, type TagDef, type LibraryTagsActions } from "../features/LibraryTagsPanel";
import {
  LibraryRulesPanel, RULE_COUNT, rulesMatching,
  type CheckerDoc, type LibraryRulesActions,
} from "../features/LibraryRulesPanel";
import { LibraryGlossaryPanel, type Term, type LibraryGlossaryActions } from "../features/LibraryGlossaryPanel";
import { LibraryGuidesPanel, type Guide, type VoiceLayer, type LibraryGuidesActions } from "../features/LibraryGuidesPanel";
import { LibraryTemplatesPanel, type Template, type LibraryTemplatesActions } from "../features/LibraryTemplatesPanel";

/* Library (pages/library.md). The project-wide editorial system: one tabbed
   page over the tag vocabulary, deterministic rule registry, style guides,
   glossary, and document templates. A top-level underline Tabs strip drives
   which Library* panel renders below. Each panel carries its own within-tab
   richness — rules by severity + a live document checker, a tag edit row,
   glossary add/edit, a template gallery with an opened template, a guides pack
   selected — so a screenshot of each tab reads the whole surface.

   Pure presenter: every collection the five panels render arrives in `data`,
   and the "nothing here yet" state is derived from all of them being empty. */

export type LibraryTab = "tags" | "rules" | "glossary" | "guides" | "templates";

/** What the Library can DO: the union of what its five panels offer.

    The Rules tab contributes only `saveRuleConfig`, and only that: the rule
    registry is compiled into LibraryRulesPanel as live RegExps, so there is no
    rule row on the server to add, edit, or scope. The panel says so on screen
    rather than drawing controls for writes that cannot happen. */
export type LibraryActions =
  LibraryTagsActions & LibraryGlossaryActions & LibraryGuidesActions
  & LibraryTemplatesActions & LibraryRulesActions;

/** Everything the Library renders, one collection per tab. */
export type LibraryData = {
  /** Which tab the page opens on. */
  tab: LibraryTab;
  tags: TagDef[];
  /** Documents in the corpus, for the tag coverage line. */
  totalDocs: number;
  /** Sample documents the rules checker can run over. */
  checkerDocs: CheckerDoc[];
  /** Workspace name, shown on the rules and guides panels. */
  workspace: string;
  terms: Term[];
  guides: Guide[];
  /** Which style pack this project has adopted. */
  defaultPack: string;
  /** The workspace's own voice layer, stacked on the pack. */
  voice: VoiceLayer;
  templates: Template[];
  /** @deprecated No longer read. The tab strip counts the very collections it
      is about to render (`countsOf`), because a separate count record and the
      panels below it could disagree — and did: a tab could badge 40 and draw
      12, and a search narrowing the rows left the badge stale. The field stays
      in the type only so existing adapters keep compiling; drop it from
      `web/src/data/library.ts` and from this type together. */
  counts: Record<LibraryTab, number>;
};

const TAB_LABELS: { id: LibraryTab; label: string }[] = [
  { id: "tags", label: "Tags" },
  { id: "rules", label: "Rules" },
  { id: "glossary", label: "Glossary" },
  { id: "guides", label: "Style guides" },
  { id: "templates", label: "Templates" },
];

const STATES = [
  { id: "default", label: "Default · Tags" },
  { id: "rules", label: "Rules · severity + doc check" },
  { id: "glossary", label: "Glossary · add / edit" },
  { id: "guides", label: "Style guides · pack selected" },
  { id: "templates", label: "Templates · gallery + opened" },
  { id: "tags-empty", label: "Tags · empty" },
  { id: "glossary-empty", label: "Glossary · empty" },
  { id: "templates-empty", label: "Templates · empty" },
  { id: "guides-empty", label: "Style guides · empty" },
  { id: "loading", label: "Loading" },
  { id: "error", label: "Error / service unavailable" },
  { id: "empty", label: "Empty / new workspace" },
  { id: "overflow", label: "Overflow · long text" },
  { id: "stress", label: "Stress · extremes" },
] as const;

/* ── Cross-tab search ──────────────────────────────────────────────────────
   The Library was five tabs each with its own filter and no way to ask "where
   does this word appear in our editorial system?" — the one question that
   spans tags, rules, glossary, guides, and templates. One field above the tab
   strip narrows every collection at once; the tab counts then say where the
   matches are, so the search doubles as the navigation to them. */

const hit = (q: string, ...fields: (string | undefined | null)[]) =>
  !q || fields.some((f) => (f ?? "").toLowerCase().includes(q));

/** The collections, narrowed to `query`. Rules filter inside their own panel
    (the registry lives there), so their count comes back separately. */
function searchLibrary(d: LibraryData, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) {
    return {
      tags: d.tags, terms: d.terms, guides: d.guides, templates: d.templates,
      rules: RULE_COUNT,
    };
  }
  return {
    tags: d.tags.filter((t) => hit(q, t.name, t.description, t.evidence)),
    terms: d.terms.filter((t) => hit(q, t.term, t.definition, t.owner)),
    guides: d.guides.filter((g) => hit(q, g.name, g.description)),
    templates: d.templates.filter((t) => hit(q, t.name, t.category, t.description)),
    rules: rulesMatching(q),
  };
}

type Narrowed = ReturnType<typeof searchLibrary>;

/** Tab counts come off the very collections the panels are about to render.
    They used to come from a separate `data.counts` record, which could — and
    did — disagree with what the tab then drew. */
function countsOf(n: Narrowed): Record<LibraryTab, number> {
  return {
    tags: n.tags.length,
    rules: n.rules,
    glossary: n.terms.length,
    guides: n.guides.length,
    templates: n.templates.length,
  };
}

/** Render the active tab from the data it was given, narrowed to the search.
    A tab with nothing in it renders its panel's own empty state, because the
    collection is empty. */
function Panel({ tab, data, narrowed, query, mobile, actions }: {
  tab: LibraryTab; data: LibraryData; narrowed: Narrowed; query: string;
  mobile: boolean; actions?: LibraryActions;
}) {
  switch (tab) {
    case "rules":
      return <LibraryRulesPanel workspace={data.workspace} docs={data.checkerDocs} query={query} actions={actions} />;
    case "glossary":
      return <LibraryGlossaryPanel terms={narrowed.terms} actions={actions} />;
    case "guides":
      return (
        <LibraryGuidesPanel
          guides={narrowed.guides}
          workspace={data.workspace}
          defaultPack={data.defaultPack}
          layer={data.voice}
          actions={actions}
        />
      );
    case "templates":
      return <LibraryTemplatesPanel compact={mobile} templates={narrowed.templates} actions={actions} />;
    case "tags":
    default:
      return <LibraryTagsPanel compact={mobile} prefiltered tags={narrowed.tags} totalDocs={data.totalDocs} actions={actions} />;
  }
}

/** A workspace with no editorial system at all. Derived from the data, so it
    is true in the real app for exactly the same reason it is true here. */
function isEmpty(d: LibraryData): boolean {
  return !d.tags.length && !d.terms.length && !d.guides.length
    && !d.templates.length && !d.checkerDocs.length;
}

function LibraryPage({ data, loading = false, error = null, actions, chrome, mobile = false }: PageProps<LibraryData, LibraryActions>) {
  const [tab, setTab] = useState<LibraryTab>(data.tab);
  const [query, setQuery] = useState("");

  /* Seeded from `data`, so a refetch that lands on a different tab is adopted
     rather than ignored (C1). */
  const [seenTab, setSeenTab] = useState(data.tab);
  if (seenTab !== data.tab) { setSeenTab(data.tab); setTab(data.tab); }

  if (loading) {
    return (
      <PageFrame chrome={chrome} active={navFor("library")} title="Library" mobile={mobile}>
        <SkeletonPage
          variant="list"
          eyebrow="Editorial system"
          title="Library"
          description="Project-wide vocabulary, deterministic rules, voice, and scaffolds for every document."
          icon={<span className="text-moss"><BookOpen size={24} /></span>}
          tabs={["Tags", "Rules", "Glossary", "Style guides", "Templates"]}
          /* The loaded header's one button and the loaded body's own search
             placeholder, both literals in this file, so both render. "Setup
             guide" is gated exactly as the loaded header gates it: with nowhere
             to navigate, the loaded page draws no button and neither may the
             skeleton. */
          actions={chrome?.onNavigate ? ["Setup guide"] : 0}
          search="Search tags, rules, terms, guides, and templates"
          /* The Tags panel's own stat captions — `activeTab` defaults to the
             first tab, which is the panel that will actually arrive. */
          stats={["Active definitions", "Documents tagged", "Need curation", "Ranking rules"]}
          mobile={mobile}
        />
      </PageFrame>
    );
  }

  const narrowed = searchLibrary(data, query);
  const counts = countsOf(narrowed);
  const tabOptions: TabOption<LibraryTab>[] =
    TAB_LABELS.map((t) => ({ ...t, count: counts[t.id] }));
  const matches = TAB_LABELS.reduce((n, t) => n + counts[t.id], 0);
  const matchedTabs = TAB_LABELS.filter((t) => counts[t.id] > 0);

  let body;
  if (error) {
    body = (
      <div className="mt-6">
        <Card>
          {/* XA-01: an EmptyState here told the reader their editorial system
              was empty when the truth was that the request did not come back. */}
          <ReadError>{error}</ReadError>
        </Card>
      </div>
    );
  } else if (isEmpty(data)) {
    body = (
      <div className="mt-6">
        <Card>
          <EmptyState title="Nothing here yet">Connect a source and add your first tags, rules, and terms to build the editorial system.</EmptyState>
        </Card>
      </div>
    );
  } else {
    body = (
      <div className="mt-6 flex flex-col gap-5">
        {/* Search above the tab strip, count strip under it and above the
            panel it describes (§13). */}
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search tags, rules, terms, guides, and templates"
          shortcut=""
          className={mobile ? "w-full" : "w-[420px]"}
        />
        <Tabs<LibraryTab> ariaLabel="Library sections" variant="underline" options={tabOptions} value={tab} onChange={setTab} />
        {/* XA-05: this was a hand-rolled count sentence with its own pluralising
            ternaries. The strip reports what the ACTIVE tab is about to render
            out of every match in the library, and names the tabs holding the
            rest so the search still doubles as navigation. */}
        {query.trim() && (
          <ResultCount
            from={counts[tab] ? 1 : 0}
            to={counts[tab]}
            total={matches}
            noun="matches"
            note={matches === 0
              ? `for "${query.trim()}"`
              : `in ${matchedTabs.map((t) => t.label.toLowerCase()).join(", ")}`}
          />
        )}
        <Panel tab={tab} data={data} narrowed={narrowed} query={query} mobile={mobile} actions={actions} />
      </div>
    );
  }

  /* The Library IS the editorial system; "Setup guide" is the walkthrough that
     populates it, which is onboarding. Offered only where there is somewhere
     to send you. */
  const headerActions = chrome?.onNavigate
    ? <Button variant="default" onClick={() => chrome.onNavigate!("welcome")}>Setup guide</Button>
    : undefined;

  return (
    <PageFrame chrome={chrome} active={navFor("library")} title="Library" mobile={mobile}>
      <div className="mx-auto max-w-[1400px] px-5 py-6 sm:px-8">
        <PageHeader
          eyebrow="Editorial system"
          title="Library"
          description="Project-wide vocabulary, deterministic rules, voice, and scaffolds for every document."
          icon={<span className="text-moss"><BookOpen size={24} /></span>}
          actions={mobile ? undefined : headerActions}
        />
        {mobile && headerActions && <div className="mt-4 flex flex-wrap items-center gap-2">{headerActions}</div>}
        {body}
      </div>
    </PageFrame>
  );
}

export const page: PageModule<LibraryData, LibraryActions> = {
  id: "library",
  title: "Library",
  route: "/library",
  component: LibraryPage,
  states: STATES.map((s) => ({ ...s })),
};
