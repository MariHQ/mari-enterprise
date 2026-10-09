import { useState } from "react";
import { Route } from "lucide-react";
import { Card } from "../layout/Card";
import { CardBody, CardTitleBlock, CardMeta, CardSection, CardActions } from "../layout/CardShell";
import { Button } from "../actions/Button";
import { Input } from "../forms/Input";
import { MarkdownEditor } from "../data-display/MarkdownEditor";
import { StatusChip, Chip, type ChipStatus } from "../data-display/Chip";
import { Avatar } from "../data-display/Avatar";
import { Sparkline } from "../data-display/Sparkline";
import { Truncate } from "../data-display/Truncate";
import { WriteError } from "../feedback/WriteError";
import { ShowRest } from "../data-display/ShowRest";
import { why } from "../actions/useWrite";
import { SourceMark } from "../icons/marks";
import { fmtDate } from "../tokens/format";
import { Skeleton, SkeletonLine, SkeletonText, SkeletonCircle, SkeletonChip } from "../data-display/Skeleton";

/* AnswerCard — the unit of the Answers ledger: one curated, human-approved
   answer that bots serve verbatim. Shows the question, the answer body
   (clamped when long), lifecycle status, owner, the channels it serves, its
   source chips, and — for approved answers — a served-per-week count with a
   sparkline. Supports inline edit, approve/retire, and per-channel serving
   toggles. Standalone with a baked demo answer. */

export type AnswerStatus = "approved" | "draft" | "retired";
const CHANNELS = ["slack-bot", "support-widget", "docs-site"] as const;
/** One place a bot serves an answer. Exported so an app can type the handler
    that writes the set back. */
export type Channel = (typeof CHANNELS)[number];
const CHANNEL_LABEL: Record<Channel, string> = { "slack-bot": "Slack bot", "support-widget": "Support widget", "docs-site": "Docs site" };

/** One curated answer, as the Answers page and its fixtures compose it. */
export type Answer = {
  id: number;
  question: string;
  answer: string;
  status: AnswerStatus;
  owner: string;
  channels: Channel[];
  sources: { source: string; title: string }[];
  served: number;
  spark: number[];
  updated: string;
  /** The observed workflow this answer was drafted from, when it was promoted
      out of one. The card links back to it so the wording and the run that
      produced the wording are one click apart. */
  trajectoryId?: number | null;
  /** When somebody should look at this answer again. ISO date, or absent. An
      answer mined from one conversation is the most perishable thing in the
      library, so the date it carries is shown rather than kept in the row. */
  recheckAfter?: string;
};

function initials(name: string) { return name.split(" ").map((w) => w[0]).slice(0, 2).join(""); }

/** What one answer card can DO. Every handler may throw; the card shows the
    server's own message and leaves the answer as it found it.

    Optional: with none of them Edit, Approve/Retire and the channel toggles
    keep the local behaviour below, which is what the design canvas renders. */
export type AnswerActions = {
  /** Persist an inline edit to the question or the served wording. */
  save?: (args: { id: number; question: string; answer: string }) => void | Promise<void>;
  /** Approve (embeds it for matching) or retire an answer. */
  setStatus?: (args: { id: number; status: AnswerStatus }) => void | Promise<void>;
  /** Replace the set of channels that serve this answer. */
  setChannels?: (args: { id: number; channels: Channel[] }) => void | Promise<void>;
  /** Open the observed workflow this answer was promoted from. Absent means
      the host cannot reach one, and no origin link is drawn — a link that
      cannot go anywhere is worse than no link. */
  openWorkflow?: (trajectoryId: number) => void;
};

export type AnswerCardProps = {
  answer: Answer;
  loading?: boolean;
  actions?: AnswerActions;
  className?: string;
};

/** Roughly the longest answer a chat client shows without a "see more" fold.
    A ceiling for guidance, never a hard limit: a long answer still saves. */
const LONG_ANSWER = 600;

export function AnswerCard({ answer: initial, loading = false, actions, className = "" }: AnswerCardProps) {
  const [a, setA] = useState<Answer>(initial);
  const [editing, setEditing] = useState(false);

  /* The card holds its own copy so a write can settle optimistically, but that
     copy was taken once, at mount. After any refetch — someone else approves
     the answer, a harvest import lands — the card kept rendering the first
     response. The sentinel adopts the new answer without clobbering an edit
     the reader is in the middle of (C1). */
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) { setSeen(initial); if (!editing) setA(initial); }

  const [editQ, setEditQ] = useState(a.question);
  const [editA, setEditA] = useState(a.answer);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const long = a.answer.length > 190;
  const approved = a.status === "approved";

  const startEdit = () => { setEditQ(a.question); setEditA(a.answer); setEditing(true); };

  const saveEdit = async () => {
    const question = editQ.trim();
    const answer = editA.trim();
    if (!question || !answer) return;
    setBusy("save");
    setFailed(null);
    const applied = () => setA((p) => ({ ...p, question, answer, updated: new Date().toISOString().slice(0, 10) }));
    if (!actions?.save) {
      window.setTimeout(() => { applied(); setBusy(null); setEditing(false); }, 500);
      return;
    }
    try {
      await actions.save({ id: a.id, question, answer });
      applied();
      setEditing(false);
    } catch (e) {
      setFailed(why(e, "That answer could not be saved."));
    } finally {
      setBusy(null);
    }
  };

  const setStatus = async (status: AnswerStatus) => {
    setBusy(status);
    setFailed(null);
    if (!actions?.setStatus) {
      window.setTimeout(() => { setA((p) => ({ ...p, status })); setBusy(null); }, 600);
      return;
    }
    try {
      await actions.setStatus({ id: a.id, status });
      setA((p) => ({ ...p, status }));
    } catch (e) {
      setFailed(why(e, "That answer's status could not be changed."));
    } finally {
      setBusy(null);
    }
  };

  const toggleChannel = async (ch: Channel) => {
    if (!approved) return;
    const channels = a.channels.includes(ch) ? a.channels.filter((c) => c !== ch) : [...a.channels, ch];
    setBusy("channels");
    setFailed(null);
    if (!actions?.setChannels) {
      window.setTimeout(() => { setA((p) => ({ ...p, channels })); setBusy(null); }, 400);
      return;
    }
    try {
      await actions.setChannels({ id: a.id, channels });
      setA((p) => ({ ...p, channels }));
    } catch (e) {
      setFailed(why(e, "That channel could not be changed."));
    } finally {
      setBusy(null);
    }
  };

  const chipStatus: ChipStatus = approved ? "approved" : a.status === "retired" ? "retired" : "draft";
  const anyBusy = busy !== null;

  if (loading) {
    return (
      <Card className={className}>
        <div className="flex gap-4" aria-hidden="true">
          <div className="min-w-0 flex-1 space-y-2.5">
            <SkeletonLine w="70%" h={15} />
            <SkeletonText lines={2} />
            <div className="flex items-center gap-2.5">
              <SkeletonChip w={72} /><SkeletonCircle size={22} /><SkeletonLine w={90} h={9} />
            </div>
            <div className="flex items-center gap-2"><SkeletonLine w={64} h={9} /><SkeletonChip w={80} /><SkeletonChip w={92} /></div>
          </div>
          <div className="flex w-40 shrink-0 flex-col items-end gap-3 border-l border-ink/10 pl-4">
            <SkeletonLine w={110} h={11} />
            <Skeleton width={120} height={26} />
            <div className="w-full space-y-2">
              <Skeleton height={30} rounded="rounded-[4px]" /><Skeleton height={30} rounded="rounded-[4px]" />
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (editing) {
    const n = editA.trim().length;
    return (
      <Card className={className}>
        <div className="flex flex-col gap-2.5">
          <Input value={editQ} onChange={(e) => setEditQ(e.target.value)} placeholder="Question" />
          {/* Bots serve this text verbatim, so the writer sees exactly how it
              lands: source on the left, the rendered answer on the right. It
              used to be a bare <Textarea> — no markdown, no preview, and no
              sense of length until the answer turned up in a chat client. */}
          <MarkdownEditor value={editA} onChange={setEditA} defaultMode="split" placeholder="The wording to serve, verbatim" />
          <p className={`font-term text-[11.5px] ${n > LONG_ANSWER ? "text-clay" : "text-ink/65"}`}>
            {n.toLocaleString("en-US")} characters
            {n > LONG_ANSWER ? `. Over ${LONG_ANSWER} characters, most chat clients fold the answer behind "see more".` : ""}
          </p>
          {/* XA-02: a refused save has no single input to sit under, so it is a
              banner beside the control that fired, not 12px under the textarea. */}
          <WriteError onDismiss={() => setFailed(null)}>{failed}</WriteError>
          <div className="flex items-center gap-2">
            <Button variant="primary" compact disabled={!editQ.trim() || !editA.trim() || busy === "save"} onClick={saveEdit}>{busy === "save" ? "Saving…" : "Save"}</Button>
            <Button compact onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardBody>
        {/* 1 + 2 — header and header summary */}
        <div>
          <h2 className="text-[13px] font-semibold text-ink">Curated answer</h2>
          <p className="mt-0.5 text-[12.5px] text-ink/70">
            Bots serve this wording verbatim. Editing it changes every channel below.
          </p>
        </div>

        {/* 4 + 5 — title and summary of the content */}
        <CardTitleBlock
          title={<Truncate>{a.question}</Truncate>}
          summary={(
            <>
              {long && !expanded
                ? <Truncate lines={2}>{a.answer}</Truncate>
                /* Expanded on request: the reader asked for the whole value, so
                   it wraps rather than truncates (CONVENTIONS.md §12). */
                : <span className="block [overflow-wrap:anywhere]">{a.answer}</span>}
              {/* XA-08: "Show more"/"Show less" was a ninth spelling of the one
                  expand affordance. Same control, same words, everywhere. */}
              {long && (
                <ShowRest
                  className="mt-1"
                  expanded={expanded}
                  onToggle={() => setExpanded((v) => !v)}
                />
              )}
            </>
          )}
        />

        {/* 6 + 7 — source and status on the left, date and author on the right */}
        <CardMeta
          /* The right-hand date/author group is whitespace-nowrap and has no
             min-width of its own, so a long owner name pinned the row at its
             full width. Letting every nowrap box in the row shrink is what
             makes the truncation below actually fire. */
          className="min-w-0 [&_.whitespace-nowrap]:min-w-0"
          source={a.sources[0] ? <Chip className="min-w-0" label={a.sources[0].source} tone="neutral" icon={<SourceMark provider={a.sources[0].source} size={13} />} /> : undefined}
          status={(
            <>
              <StatusChip status={chipStatus} />
              {/* A recheck date is a state, not a second "updated": it says
                  this wording has a shelf life. Rendered only when the answer
                  actually carries one (§9). */}
              {a.recheckAfter && <Chip label={`Recheck ${fmtDate(a.recheckAfter)}`} tone="attention" dot />}
            </>
          )}
          date={<span className="shrink-0">Updated {fmtDate(a.updated)}</span>}
          author={(
            /* The meta line is whitespace-nowrap, so the owner name has to be
               allowed to shrink and ellipsize; otherwise a long name sets the
               row's width and drags the card past its own border. */
            <span className="flex min-w-0 items-center gap-1.5">
              <Avatar initials={initials(a.owner)} />
              <span className="min-w-0 truncate text-[12px] text-ink/70" title={a.owner}>{a.owner}</span>
            </span>
          )}
        />

        {/* 8 — references */}
        {a.sources.length > 0 && (
          <CardSection label="References" count={a.sources.length}>
            <div className="flex flex-wrap items-center gap-1.5">
              {a.sources.map((s) => (
                <Chip key={s.title} label={s.title} tone="neutral" icon={<SourceMark provider={s.source} size={13} />} className="max-w-full [&>span]:truncate" />
              ))}
            </div>
          </CardSection>
        )}

        {/* 9 — connections */}
        <CardSection label="Connections" count={a.channels.length}
          action={approved ? undefined : <span className="font-term text-[11px] text-ink/65">Approve to serve</span>}>
          <div className="flex flex-wrap items-center gap-1.5">
            {CHANNELS.map((ch) => {
              const on = a.channels.includes(ch);
              return (
                <Chip
                  key={ch}
                  label={CHANNEL_LABEL[ch]}
                  tone={approved && on ? "ok" : "neutral"}
                  dot={approved && on}
                  onClick={approved && !anyBusy ? () => toggleChannel(ch) : undefined}
                  selected={approved && on}
                />
              );
            })}
          </div>
        </CardSection>

        {/* Where this answer came from. Only drawn when it was promoted out of
            an observed run AND the host can open one. */}
        {a.trajectoryId != null && actions?.openWorkflow && (
          <CardSection label="Origin">
            <Button variant="link" compact onClick={() => actions.openWorkflow!(a.trajectoryId!)}>
              <Route size={13} /> Open the workflow this came from
            </Button>
          </CardSection>
        )}

        {/* 10 — owners */}
        <CardSection label="Owners">
          <span className="flex min-w-0 items-center gap-1.5">
            <Avatar initials={initials(a.owner)} />
            <span className="min-w-0 truncate text-[12.5px] text-ink/80" title={a.owner}>{a.owner}</span>
          </span>
        </CardSection>

        {approved && (
          <CardSection label="Served per week">
            <div className="flex items-center gap-3">
              <b className="text-[15px] text-ink">{a.served.toLocaleString()}</b>
              <Sparkline values={a.spark} tone="ok" />
            </div>
          </CardSection>
        )}

        {/* Approve/Retire and the channel toggles all report here; none of them
            accuses an input, so all of them are WriteErrors (XA-02). */}
        <WriteError onDismiss={() => setFailed(null)}>{failed}</WriteError>

        {/* 11 + 12 — buttons, biggest action last */}
        <CardActions
          primary={<Button compact disabled={anyBusy} onClick={startEdit}>Edit</Button>}
          secondary={approved ? (
            <Button variant="danger" compact disabled={anyBusy} onClick={() => setStatus("retired")}>{busy === "retired" ? "Retiring\u2026" : "Retire"}</Button>
          ) : (
            <Button variant="primary" compact disabled={anyBusy} onClick={() => setStatus("approved")}>{busy === "approved" ? "Embedding\u2026" : "Approve"}</Button>
          )}
        />
      </CardBody>
    </Card>
  );
}

export default AnswerCard;
