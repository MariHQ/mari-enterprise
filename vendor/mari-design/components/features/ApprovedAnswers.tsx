import { useEffect, useState, type ComponentProps } from "react";
import { Sparkles, Plus, MessageSquare, CheckCircle2, Circle, MessagesSquare, FileText } from "lucide-react";
import { AnswerCard, type Answer, type AnswerActions } from "./AnswerCard";
import { Card, Stat, Tabs, Button, Chip, Stepper, Spinner, Textarea, EmptyState, Input } from "../index";
import { SPLIT } from "../tokens/pagegrid";
import { MarkdownEditor } from "../data-display/MarkdownEditor";
import { Pagination, ResultCount, usePaged } from "../data-display/Pagination";
import { ShowRest } from "../data-display/ShowRest";
import { ReadError } from "../feedback/ReadError";
import { WriteError } from "../feedback/WriteError";
import { useWrite, why } from "../actions/useWrite";

/* Approved answers: the answers bots serve verbatim.
   A stat strip, a status-filter tab strip, a list of AnswerCards, and a
   supporting band (coverage + how-serving-works) across the top.

   This used to be its own page at /answers. It is a TAB of Workflows now, for
   the reason the two belong together: an approved answer is what an observed
   workflow is promoted into, and reviewing the run and curating the answer it
   produced were two pages apart. Lifted here as a feature so the page that
   hosts it stays a page — WorkflowsPage owns the frame, the header and the tab
   strip, and this owns everything below.

   It holds no demo content. Answers, coverage gaps, and the harvest wizard's
   state all arrive in `data`, so a workspace with nothing approved renders the
   empty state rather than someone's invented library. The design canvas
   supplies the same shape from `.preview/fixtures/workflows.ts`. */

export type AnswersFilter = "all" | "approved" | "drafts" | "retired";

/* Tab id → the lifecycle status behind it. The tabs are plural, the status on
   an answer is not, so the strip needs the mapping to filter anything. */
const OF_STATUS: Record<Exclude<AnswersFilter, "all">, Answer["status"]> = {
  approved: "approved", drafts: "draft", retired: "retired",
};

const inFilter = (answers: Answer[], filter: AnswersFilter): Answer[] =>
  filter === "all" ? answers : answers.filter((a) => a.status === OF_STATUS[filter]);

/** One tile of the headline strip. */
export type AnswerStat = {
  value: string;
  label: string;
  tone: ComponentProps<typeof Stat>["tone"];
  sub: string;
};

/** A source the harvest wizard can scan. `key` picks the icon, so the shape
    stays plain JSON: an API can return it, and no React element is carried. */
export type HarvestSource = { key: string; label: string; desc: string; on: boolean };

/** One question/answer pair the scan proposed. */
export type HarvestCandidate = { question: string; draft: string; source: string; confidence: number };

/** The harvest wizard's starting point. An app opens it at "select"; the
    canvas opens it at whichever step it wants to review. */
export type Harvest = {
  phase: "select" | "scan" | "review" | "importing" | "done";
  sources: HarvestSource[];
  /** What the scan is doing right now, shown under the spinner. */
  scanning: string;
  candidates: HarvestCandidate[];
};

/** What the main column shows. The rail is the same in every case, except that
    the coverage pane moves coverage out of the rail and into the column. */
export type AnswersPane =
  | { kind: "answers" }
  | { kind: "coverage" }
  | { kind: "harvest"; harvest: Harvest };

/** What the Answers page can DO. Per-card writes come from `AnswerActions`;
    `create` is this page's own, behind "New answer" and "Draft answer".

    Optional, as always: with no actions the composer still opens and the cards
    still respond locally, which is what the design canvas renders. */
export type AnswersActions = AnswerActions & {
  /** Save a new answer. It lands as a draft until someone approves it. */
  create?: (args: { question: string; answer: string }) => void | Promise<void>;
  /** Scan the chosen sources for question/answer pairs. Answers with what it
      found, so the wizard reviews the server's result rather than reading it
      back from a second query. */
  harvest?: (sources: HarvestSource["key"][]) => Promise<HarvestCandidate[]>;
  /** Save the accepted candidates as draft answers, in one go. */
  importAnswers?: (drafts: { question: string; answer: string }[]) => void | Promise<void>;
};

/** Everything the Answers page renders. */
export type AnswersData = {
  stats: AnswerStat[];
  /** Which status tab opens selected. */
  filter: AnswersFilter;
  answers: Answer[];
  /** Questions people ask that no approved answer covers yet. */
  coverage: string[];
  /** The sources this workspace can harvest from, in the order to offer them.
      This was a three-item list hardcoded in the library, so a workspace with
      Notion, Jira or Zendesk connected could not harvest from any of them, and
      one with no Slack was offered Slack anyway. Empty or omitted means there
      is nothing to scan, and no "Harvest questions" button is drawn (§2). */
  harvestSources?: HarvestSource[];
  pane: AnswersPane;
};

/** No answers and no coverage gaps: nothing has been curated at all. Derived
    from the data, not from a state flag, so it is true in the real app for
    exactly the same reason it is true on the canvas. */
function isEmpty(d: AnswersData): boolean {
  return !d.answers.length && !d.coverage.length;
}

const HARVEST_STEP: Record<Harvest["phase"], number> = {
  select: 0, scan: 1, review: 2, importing: 3, done: 3,
};

const sourceIcon = (key: string): React.ReactNode =>
  key === "slack" ? <MessagesSquare size={18} />
    : key === "chat" ? <Sparkles size={18} />
      : <FileText size={18} />;

/** `data` is the whole page's answers — what "nothing curated at all" is judged
    against — while `answers` is only the selected tab's slice. Judging both off
    the slice would call a workspace empty because one tab happens to be. */
function AnswersList({ data, filter, answers, error, actions, onCompose }: {
  data: AnswersData; filter: AnswersFilter; answers: Answer[];
  error: string | null; actions?: AnswersActions; onCompose: (question: string) => void;
}) {
  const pager = usePaged(answers, 24);
  if (error) {
    /* A failed read is not an empty library: an EmptyState here told the reader
       they had curated nothing when the truth was that the request did not come
       back (§8, XA-01). */
    return (
      <Card>
        <ReadError>{error}</ReadError>
      </Card>
    );
  }
  if (isEmpty(data)) {
    return (
      <Card>
        <EmptyState title="No answers yet" action={<Button variant="primary" compact onClick={() => onCompose("")}><Plus size={14} /> New answer</Button>}>
          Approve your first answer so bots can serve it verbatim.
        </EmptyState>
      </Card>
    );
  }
  if (!answers.length) {
    const copy: Record<AnswersFilter, string> = {
      all: "No answers yet.",
      approved: "No approved answers yet.",
      drafts: "No drafts yet.",
      retired: "No retired answers.",
    };
    return (
      <Card>
        <EmptyState title="Nothing here" action={<Button variant="primary" compact onClick={() => onCompose("")}><Plus size={14} /> New answer</Button>}>
          {copy[filter]}
        </EmptyState>
      </Card>
    );
  }
  /* A card gallery, not a single stacked column (§11). The list used to run
     down a 1,060px column beside a rail that ran out after two cards, so a
     workspace with a dozen answers was 1,900px of list beside 1,100px of empty
     page. Two-up at the full container width halves that, and `flex-1
     basis-[520px]` means a short last row stretches instead of leaving a dead
     bottom-right corner. Siblings in a row share a height (§15). */
  return (
    <div className="flex flex-col gap-3">
      {pager.paged && <ResultCount from={pager.from} to={pager.to} total={pager.total} noun="answers" />}
      <div className="flex flex-wrap gap-5 [&>*]:min-w-0 [&>*]:flex-1 [&>*]:basis-[520px]">
        {pager.pageRows.map((a) => <AnswerCard key={a.id} answer={a} actions={actions} />)}
      </div>
      {pager.paged && <Pagination page={pager.page} pageCount={pager.pageCount} onChange={pager.setPage} />}
    </div>
  );
}

/* The rail used to slice to two questions and say nothing about the rest, and
   the `coverage` pane that shows all of them had nothing pointing at it. The
   count is now above the list it describes (§13) and "See all" is what reaches
   the pane. */
function CoverageCard({
  questions, error, extended = false, onCompose, onSeeAll,
}: {
  questions: string[]; error: string | null; extended?: boolean;
  onCompose: (question: string) => void;
  onSeeAll?: () => void;
}) {
  /* Three across the band, which is what one row of `basis-[280px]` holds at
     the container width. It was two, stacked in a 320px rail. */
  const BAND = 3;
  const qs = extended ? questions : questions.slice(0, BAND);
  const hidden = questions.length - qs.length;
  return (
    <Card>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-[14px] font-semibold text-ink">Coverage</span>
      </div>
      {error ? (
        /* The rail used to report a failed read as an EmptyState carrying a
           bespoke "Coverage unavailable." — an empty state must never report a
           failure, and the copy for one comes from the catalog (§8, XA-01). */
        <ReadError>{error}</ReadError>
      ) : questions.length === 0 ? (
        <EmptyState title="All covered">No uncovered questions yet.</EmptyState>
      ) : (
        <div className="space-y-3">
          {/* One count strip, above the list it describes (§13, XA-07): the
              hand-rolled "N of M uncovered" span sat on the header line, and
              "See all …" was one of eight spellings of the same toggle. */}
          <ResultCount
            from={1}
            to={qs.length}
            total={questions.length}
            noun="uncovered questions"
            actions={hidden > 0 && onSeeAll
              ? <ShowRest expanded={false} total={questions.length} onToggle={onSeeAll} />
              : undefined}
          />
          {/* Across, not down: the card is full width now, in the band and in
              the pane alike, and a stack of one-line questions in it would be
              short lines with a page of nothing beside them (§11). */}
          <div className="flex flex-wrap gap-3 [&>*]:min-w-0 [&>*]:flex-1 [&>*]:basis-[215px]">
          {qs.map((q) => (
            <div key={q} className="rounded-[6px] border border-ink/12 p-3">
              <div className="text-[13px] text-ink">{q}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-ink/65">
                <MessageSquare size={12} /> from chat logs
              </div>
              <Button variant="link" compact className="mt-1.5" onClick={() => onCompose(q)}>Draft answer</Button>
            </div>
          ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function HowServingWorks() {
  return (
    <Card>
      <div className="mb-1.5 text-[14px] font-semibold text-ink">How serving works</div>
      <p className="text-[12.5px] leading-relaxed text-ink/70">
        Approving an answer embeds it so incoming questions match semantically. The Slack
        bot and support widget then serve the text verbatim with an “Approved” badge: no
        generation, no drift.
      </p>
    </Card>
  );
}

/* The supporting band, above the answers rather than beside them.

   It was a 320px rail, and that is what made this page the worst instance of
   the dead-space bug in the console: Coverage plus the explainer are about
   760px of card, the answer list is as long as the library is, and the rail
   simply stopped — over 1,100px of empty right third on the default state
   alone. Nothing could fill it honestly, because there is no third thing this
   page knows. So the supporting cards run across the top instead, on the same
   1fr/320px plumb line the rail used, and the answers below get the whole
   container width (§11). */
function CoverageBand({
  questions, error, withCoverage, mobile, onCompose, onSeeAll,
}: {
  questions: string[]; error: string | null; withCoverage: boolean; mobile: boolean;
  onCompose: (question: string) => void; onSeeAll: () => void;
}) {
  if (!withCoverage) return <HowServingWorks />;
  return (
    <div className={mobile ? "flex flex-col gap-5" : SPLIT[320]}>
      <div className="min-w-0">
        <CoverageCard questions={questions} error={error} onCompose={onCompose} onSeeAll={onSeeAll} />
      </div>
      <div className="min-w-0"><HowServingWorks /></div>
    </div>
  );
}

/* ── Answer body ───────────────────────────────────────────────────────────
   Bots serve this text VERBATIM, so what the writer sees while typing has to
   be what the reader gets. It used to be a bare <Textarea>: no way to see how
   a list or a link would land, and no sense of length until it turned up in
   Slack. The composer and the card's inline edit now share one editor
   (data-display/MarkdownEditor: source pane + live preview) and one length
   readout. */

/** Roughly the longest answer a chat client shows without a "see more" fold.
    A ceiling for guidance, never a hard limit: a long answer is still saved. */
const LONG_ANSWER = 600;

function AnswerLength({ value }: { value: string }) {
  const n = value.trim().length;
  const long = n > LONG_ANSWER;
  return (
    <p className={`font-term text-[11.5px] ${long ? "text-clay" : "text-ink/65"}`}>
      {n.toLocaleString("en-US")} characters
      {long
        ? `. Over ${LONG_ANSWER} characters, most chat clients fold the answer behind "see more".`
        : ""}
    </p>
  );
}

/* The composer sits at the top of the main column, opened by "New answer" or
   by "Draft answer" on a coverage gap — which prefills the question, so the
   uncovered question and the answer to it are never retyped apart.

   Fields first, primary action bottom left (§2). */
function NewAnswer({ question: initial, actions, onClose }: {
  question: string; actions?: AnswersActions; onClose: () => void;
}) {
  const [question, setQuestion] = useState(initial);
  const [answer, setAnswer] = useState("");
  const [saved, setSaved] = useState(false);
  /* One hook for the busy/failed pair the composer used to keep by hand: no
     handler runs the local echo, a handler is awaited before the form claims
     the draft was saved (XA-04). */
  const write = useWrite();

  const save = async () => {
    if (!question.trim() || !answer.trim() || write.busy) return;
    await write.run(
      actions?.create && (() => actions.create!({ question: question.trim(), answer: answer.trim() })),
      () => setSaved(true),
    );
  };

  return (
    <Card>
      <div className="mb-2 text-[14px] font-semibold text-ink">New answer</div>
      {saved ? (
        <>
          <p className="text-[13px] text-ink/70">
            Saved as a draft. Approve it below and bots will serve this wording verbatim.
          </p>
          <div className="mt-3"><Button variant="primary" compact onClick={onClose}>Done</Button></div>
        </>
      ) : (
        <div className="flex flex-col gap-2.5">
          <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Question people ask" />
          <MarkdownEditor
            value={answer}
            onChange={setAnswer}
            defaultMode="split"
            placeholder="The wording to serve, verbatim"
          />
          <AnswerLength value={answer} />
          {/* A refused save has no single input to sit under, so it is a
              banner beside the control that fired, not a FieldError (XA-02). */}
          <WriteError onDismiss={() => write.setFailed(null)}>{write.failed}</WriteError>
          <div className="flex items-center gap-2">
            <Button variant="primary" compact disabled={write.busy || !question.trim() || !answer.trim()} onClick={save}>
              {write.busy ? "Saving…" : "Save draft"}
            </Button>
            <Button compact disabled={write.busy} onClick={onClose}>Cancel</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ── Harvest wizard ────────────────────────────────────────────────────────
   Scan sources for question/answer pairs people keep asking, review what came
   back, import the keepers as drafts.

   This was five static renditions of a drawer: `data.pane.harvest.phase`
   picked which step to draw, and every control in every step was inert — you
   could not select a source, skip a candidate, or import anything. It is now
   one state machine that actually advances, and `data.pane.harvest` seeds its
   starting point so the canvas can still open on any step.

   The scan and the import are optional actions, like every write in this
   library. Without them the wizard still runs end to end on the candidates it
   was given, which is what the canvas renders; with them the scan is the
   server's answer and the import is a real write. */

function confTone(c: number): ComponentProps<typeof Chip>["tone"] {
  return c >= 75 ? "ok" : c >= 45 ? "attention" : "neutral";
}

/** Confidence at or above which "Accept all high confidence" selects. */
const HIGH_CONFIDENCE = 75;

/** A candidate plus what the reviewer has done to it. `draft` is separate from
    the proposal so editing the wording never loses what was suggested.

    `key` is the row's identity for React. A scan legitimately returns the same
    question twice (asked in two channels, answered differently), and keying the
    rows by `r.question` collapsed those two into one: the second candidate
    silently vanished from the review, along with any chance of importing it. */
type Reviewed = HarvestCandidate & { key: string; accepted: boolean; draft: string };

/** Stable per-scan identity: the position in the result the server returned. */
const reviewed = (c: HarvestCandidate, i: number, accepted: boolean): Reviewed =>
  ({ ...c, key: `${i}:${c.question}`, accepted, draft: c.draft });

function HarvestWizard({ harvest, actions, onClose }: {
  harvest: Harvest;
  actions?: AnswersActions;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Harvest["phase"]>(harvest.phase);
  const [sources, setSources] = useState<HarvestSource[]>(harvest.sources);
  const [rows, setRows] = useState<Reviewed[]>(
    () => harvest.candidates.map((c, i) => reviewed(c, i, true)),
  );
  const [failed, setFailed] = useState<string | null>(null);

  const selected = sources.filter((s) => s.on);
  const accepted = rows.filter((r) => r.accepted);
  const step = HARVEST_STEP[phase];

  /* By key, not by label: two sources can share a display name, and toggling
     one would have toggled both. */
  const toggleSource = (key: HarvestSource["key"]) =>
    setSources((prev) => prev.map((s) => (s.key === key ? { ...s, on: !s.on } : s)));

  const scan = async () => {
    setFailed(null);
    setPhase("scan");
    try {
      // With no handler the wizard reviews what it was given, which is how the
      // canvas drives it; with one, the server decides what was found.
      const found = actions?.harvest
        ? await actions.harvest(selected.map((s) => s.key))
        : harvest.candidates;
      setRows(found.map((c, i) => reviewed(c, i, c.confidence >= HIGH_CONFIDENCE)));
      setPhase("review");
    } catch (e) {
      setFailed(why(e, "The scan could not finish."));
      setPhase("select");
    }
  };

  const importDrafts = async () => {
    setFailed(null);
    setPhase("importing");
    try {
      if (actions?.importAnswers) {
        await actions.importAnswers(accepted.map((r) => ({ question: r.question, answer: r.draft })));
      }
      setPhase("done");
    } catch (e) {
      setFailed(why(e, "The import could not finish."));
      setPhase("review");
    }
  };

  return (
    <Card>
      <div className="mb-5 flex items-center gap-2 text-[15px] font-semibold text-ink">
        <Sparkles size={16} className="text-biscay-2" /> Harvest questions
      </div>
      <Stepper labels={["Sources", "Scan", "Review", "Import"]} current={step} />

      {failed && <div className="mt-4"><WriteError>{failed}</WriteError></div>}

      {phase === "select" && (
        <div className="mt-5 flex flex-col gap-3">
          <p className="text-[13px] text-ink/70">Pick the sources Mari should scan for question and answer candidates. Nothing is saved until you import.</p>
          {sources.map((s) => (
            <label
              key={s.key}
              className={`flex cursor-pointer items-start gap-3 rounded-[5px] border px-3.5 py-3 ${s.on ? "border-biscay-2/60 bg-biscay-2/[0.04] ring-1 ring-biscay-2/40" : "border-ink/15"}`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={s.on}
                onChange={() => toggleSource(s.key)}
              />
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[5px] ${s.on ? "bg-biscay text-white" : "bg-flysch text-ink/70 border border-ink/12"}`}>{sourceIcon(s.key)}</span>
              <span className="min-w-0">
                <b className="block text-[13.5px] font-semibold text-ink">{s.label}</b>
                <span className="text-[12.5px] text-ink/65">{s.desc}</span>
              </span>
            </label>
          ))}
          <div className="flex items-center gap-2">
            <Button variant="primary" disabled={selected.length === 0} onClick={() => void scan()}>
              {selected.length === 0 ? "Pick a source to scan" : `Scan ${selected.length} source${selected.length === 1 ? "" : "s"}`}
            </Button>
            <Button variant="default" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      )}

      {phase === "scan" && (
        <div className="mt-6 flex flex-col items-center gap-3 py-8 text-center">
          <Spinner size="md" label="Scanning" />
          <div className="text-[13px] text-ink/70">{harvest.scanning}</div>
          <div className="font-term text-[11.5px] text-ink/65">Clustering threads · extracting question/answer pairs</div>
          {/* A model pass over a corpus is minutes, not moments, on a local
              model — without a clock and an honest expectation, a working
              scan reads as a dead one and gets abandoned. */}
          <ScanClock />
          <div className="max-w-[46ch] text-[11.5px] text-ink/60">
            The workspace model reads every selected document in one pass.
            On a hosted model this is under a minute; on a local model it can
            take several.
          </div>
        </div>
      )}

      {phase === "review" && (
        <div className="mt-5 flex flex-col gap-3">
          {rows.length === 0 ? (
            <>
              <p className="text-[13px] text-ink/70">The scan found no question and answer pairs in those sources.</p>
              <div className="flex items-center gap-2">
                <Button variant="primary" onClick={() => setPhase("select")}>Pick different sources</Button>
                <Button variant="default" onClick={onClose}>Cancel</Button>
              </div>
            </>
          ) : (
            <>
              {/* The review's own count strip, above the rows it describes
                  (§13, XA-07). The hand-rolled span reported the same two
                  numbers in a fourth wording. */}
              <ResultCount
                from={1}
                to={rows.length}
                total={rows.length}
                noun="candidates"
                note={`${accepted.length.toLocaleString("en-US")} accepted`}
                actions={
                  <Button
                    compact
                    onClick={() => setRows((prev) => prev.map((r) => (r.confidence >= HIGH_CONFIDENCE ? { ...r, accepted: true } : r)))}
                  >
                    Accept all high confidence
                  </Button>
                }
              />
              {rows.map((r, i) => (
                <Card key={r.key} className={r.accepted ? undefined : "opacity-55"}>
                  <h3 className="text-[13.5px] font-semibold text-ink">{r.question}</h3>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Chip label={r.source} tone="neutral" />
                    <Chip label={`${r.confidence}% confident`} tone={confTone(r.confidence)} dot />
                  </div>
                  <Textarea
                    short
                    className="mt-2.5"
                    value={r.draft}
                    onChange={(e) => setRows((prev) => prev.map((x, j) => (j === i ? { ...x, draft: e.target.value } : x)))}
                  />
                  <div className="mt-2.5 flex items-center gap-2">
                    {r.accepted && <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-moss"><CheckCircle2 size={15} /> Accepted</span>}
                    <span className="flex-1" />
                    <Button
                      compact
                      onClick={() => setRows((prev) => prev.map((x, j) => (j === i ? { ...x, accepted: !x.accepted } : x)))}
                    >
                      {r.accepted ? "Skip" : "Accept"}
                    </Button>
                  </div>
                </Card>
              ))}
              <div className="flex items-center gap-2">
                <Button variant="primary" disabled={accepted.length === 0} onClick={() => void importDrafts()}>
                  {accepted.length === 0 ? "Accept at least one" : `Import ${accepted.length} draft${accepted.length === 1 ? "" : "s"}`}
                </Button>
                <Button variant="default" onClick={onClose}>Cancel</Button>
              </div>
            </>
          )}
        </div>
      )}

      {(phase === "importing" || phase === "done") && (
        <div className="mt-5 flex flex-col gap-4">
          <p className="text-[13px] text-ink/70">
            {phase === "importing"
              ? `Saving ${accepted.length} draft answers…`
              : `Imported ${accepted.length} draft answers. They're queued in the Drafts filter for approval.`}
          </p>
          <ul className="flex flex-col gap-2">
            {accepted.map((r, i) => {
              const saving = phase === "importing" && i === accepted.length - 1;
              const done = phase === "done" || i < accepted.length - 1;
              return (
                <li key={r.key} className="flex items-center gap-2.5 text-[13px] text-ink/80">
                  {done ? <CheckCircle2 size={16} className="shrink-0 text-moss" />
                    : saving ? <Spinner size="sm" />
                    : <Circle size={14} className="shrink-0 text-ink/30" />}
                  {/* §12: a value that may ellipsize carries the whole of
                      itself in `title`, so the reader can still reach it. */}
                  <span className="min-w-0 flex-1 truncate" title={r.question}>{r.question}</span>
                  <span className="font-term text-[11px] shrink-0 text-ink/65">
                    {done ? "draft saved" : saving ? "saving…" : "queued"}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center gap-2">
            <Button variant="primary" disabled={phase === "importing"} onClick={onClose}>
              {phase === "importing" ? "Saving…" : "Done"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}


function Body({ data, error, actions, mobile, composing, onCompose, onCloseComposer, harvest, onCloseHarvest, isCoverage, onSeeAllCoverage, onCloseCoverage }: {
  data: AnswersData; error: string | null; actions?: AnswersActions; mobile: boolean;
  /** The question the composer opened on, or null when it is closed. */
  composing: string | null;
  onCompose: (question: string) => void;
  onCloseComposer: () => void;
  /** The harvest wizard's starting point, or null when it is closed. */
  harvest: Harvest | null;
  onCloseHarvest: () => void;
  /** The coverage pane has taken over the main column. */
  isCoverage: boolean;
  onSeeAllCoverage: () => void;
  /** Leave the coverage pane. Absent when the pane IS the route. */
  onCloseCoverage?: () => void;
}) {
  /* The strip filters the answers the page was given; `data.filter` only says
     which tab opens selected. The state fed nothing but the empty-state copy
     before, so every tab drew the same list.

     Seeded from `data`, so it resyncs when `data` changes: without the
     sentinel a refetch that lands on a different tab kept rendering the tab
     from the first response (C1). */
  const [filter, setFilter] = useState<AnswersFilter>(data.filter);
  const [seenFilter, setSeenFilter] = useState(data.filter);
  if (seenFilter !== data.filter) { setSeenFilter(data.filter); setFilter(data.filter); }
  const shown = inFilter(data.answers, filter);

  /* One main column, full container width, for every state — the composer, the
     harvest wizard, the coverage pane and the list all share the same outer
     edges (§11). */
  const main = harvest ? (
    <HarvestWizard harvest={harvest} actions={actions} onClose={onCloseHarvest} />
  ) : isCoverage ? (
    <div className="flex flex-col gap-2.5">
      <CoverageCard questions={data.coverage} error={error} extended onCompose={onCompose} />
      {onCloseCoverage && (
        <div><Button compact onClick={onCloseCoverage}>Back to answers</Button></div>
      )}
    </div>
  ) : (
    <div className="flex flex-col gap-5">
      <Tabs
        ariaLabel="Filter answers"
        /* Underline variant: the Knowledge tab bar is the one standard
           selection bar across the console (CONVENTIONS.md §13). */
        variant="underline"
        value={filter}
        onChange={setFilter}
        /* Counts come off the same list the tabs filter, so a tab can never
           promise rows the column then fails to show. */
        options={[
          { id: "all", label: "All", count: data.answers.length },
          { id: "approved", label: "Approved", count: inFilter(data.answers, "approved").length },
          { id: "drafts", label: "Drafts", count: inFilter(data.answers, "drafts").length },
          { id: "retired", label: "Retired", count: inFilter(data.answers, "retired").length },
        ]}
      />
      <AnswersList data={data} filter={filter} answers={shown} error={error} actions={actions} onCompose={onCompose} />
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Stat strip as a §11 card gallery rather than a hard three-up grid: at
          1024 and below a third of the content column is narrower than a stat
          tile wants, and a grid would leave a dead cell instead of letting the
          short last row stretch. */}
      <div className={mobile ? "grid grid-cols-1 gap-5" : "flex flex-wrap gap-5 [&>*]:min-w-0 [&>*]:flex-1 [&>*]:basis-[220px]"}>
        {data.stats.map((s) => <Stat key={s.label} value={s.value} label={s.label} tone={s.tone} sub={s.sub} />)}
      </div>

      <CoverageBand
        questions={data.coverage}
        error={error}
        withCoverage={!isCoverage}
        mobile={mobile}
        onCompose={onCompose}
        onSeeAll={onSeeAllCoverage}
      />

      {composing !== null && (
        <NewAnswer question={composing} actions={actions} onClose={onCloseComposer} />
      )}
      {main}
    </div>
  );
}

/** The Approved answers tab.

    Everything AnswersPage rendered below its PageHeader, plus the tab's own
    action row: the page header above now names Workflows, so "Harvest
    questions" and "New answer" belong to the tab that owns them (§2, §13). */
export function ApprovedAnswers({ data, error = null, actions, mobile = false }: {
  data: AnswersData;
  error?: string | null;
  actions?: AnswersActions;
  mobile?: boolean;
}) {
  /* The composer is a mode of this tab, not a property of the library: it
     opens on "" for a blank answer, or on the text of a coverage gap. */
  const [composing, setComposing] = useState<string | null>(null);

  /* The wizard is a mode of this tab. `data.pane` can pin it open on a given
     step (that is how the canvas reviews each one); otherwise the button above
     opens it at the beginning. */
  const pinned = data.pane.kind === "harvest" ? data.pane.harvest : null;
  const [harvesting, setHarvesting] = useState<Harvest | null>(null);
  const harvest = harvesting ?? pinned;

  /* Same shape for the coverage pane: `data.pane` can route straight to it,
     and the band's "See all" reaches it from inside the tab. */
  const [seeAllCoverage, setSeeAllCoverage] = useState(false);
  const [seenPaneKind, setSeenPaneKind] = useState(data.pane.kind);
  if (seenPaneKind !== data.pane.kind) {
    setSeenPaneKind(data.pane.kind);
    setSeeAllCoverage(false);
    setHarvesting(null);
  }
  const isCoverage = seeAllCoverage || data.pane.kind === "coverage";

  /* Harvest is offered only where there is something to scan. The source list
     used to be a constant in this file, so the button was always drawn and
     always offered the same three places (§2). */
  const harvestSources = data.harvestSources ?? [];

  return (
    <div className="flex flex-col gap-5">
      {/* The tab's toolbar. Its actions sit top right of the content they act
          on, matching the Observed tab's own toolbar row (§2, §13). */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 max-w-[70ch] text-[13px] text-ink/70">
          Curate the answers bots and teams serve verbatim: no generation, no drift.
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {harvestSources.length > 0 && (
            <Button
              variant="default"
              compact
              onClick={() => setHarvesting({
                phase: "select",
                sources: harvestSources,
                scanning: "Reading recent threads\u2026",
                candidates: [],
              })}
            >
              <Sparkles size={15} /> Harvest questions
            </Button>
          )}
          <Button variant="primary" compact onClick={() => setComposing("")}><Plus size={15} /> New answer</Button>
        </div>
      </div>
      <Body
        data={data}
        error={error}
        actions={actions}
        mobile={mobile}
        composing={composing}
        onCompose={setComposing}
        onCloseComposer={() => setComposing(null)}
        harvest={harvest}
        onCloseHarvest={() => setHarvesting(null)}
        isCoverage={isCoverage}
        onSeeAllCoverage={() => setSeeAllCoverage(true)}
        onCloseCoverage={seeAllCoverage ? () => setSeeAllCoverage(false) : undefined}
      />
    </div>
  );
}

export default ApprovedAnswers;

/** Elapsed time under a long scan. Its own component so one ticking second
    does not re-render the wizard around it. */
function ScanClock() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="font-term text-[11.5px] text-ink/65" role="timer">
      {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")} elapsed
    </div>
  );
}

