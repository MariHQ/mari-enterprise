// DocReview findings / fact-check panel — two tabs: Fact check (claim tallies,
// the top contradiction as a two-part evidence callout, and a create-review-task
// row) and All claims (the full claim list with status). Ported from
// mari-cloud/web/src/pages/docreview/FindingsPanel.tsx. Renders standalone with
// baked-in facts, findings, and task owners; the run/create-task flows are
// simulated locally.

import { Fragment, useState } from "react";
import { Check, ShieldCheck, CheckCircle2, ChevronDown, Calendar, ArrowRight, FileText } from "lucide-react";
import { Card } from "../layout/Card";
import { CardActions } from "../layout/CardShell";
import { Button } from "../actions/Button";
import { StatusChip } from "../data-display/Chip";
import { Combobox } from "../forms/Combobox";
import { Menu, MenuRadioGroup, MenuRadioItem } from "../navigation/Menu";
import { Tabs } from "../navigation/Tabs";
import { fmtDate } from "../tokens/format";
import { Skeleton, SkeletonLine, SkeletonText } from "../data-display/Skeleton";
import { Truncate } from "../data-display/Truncate";
import { Scrollable } from "../data-display/Scrollable";
import { ResultCount } from "../data-display/Pagination";
import { WriteError } from "../feedback/WriteError";
import { CreateReviewTaskButton } from "../actions/RepeatedActions";
import { why } from "../actions/useWrite";
import { factStatusKey } from "./FactsVerificationAudit";

/** One fact-check finding. */
export type DocFinding = { id: number; kind: string; severity: string; text: string; note: string };
/** Is this claim verified, however the extractor spelled the word? */
const isVerifiedClaim = (c: DocClaim) => factStatusKey(c.status) === "verified";

/** One extracted claim and its verification status. */
export type DocClaim = { claim: string; source: string; status: string; verified: string };
type FactTab = "check" | "claims";

/* ————— demo data ————— */

/* A due date is a value with two faces: the ISO date a task is stored with,
   and the label the picker shows (§5 — always with a year). Carrying both
   means the menu can never hand a mutation the display string. */
const daysFromNow = (days: number) => {
  const at = new Date(Date.now() + days * 86400000);
  return { iso: at.toISOString().slice(0, 10), label: fmtDate(at) };
};
/* Owner picker is a searchable Combobox (CONVENTIONS.md §7), so the roster can
   grow past the three demo names without becoming a scroll hunt. */
const TASK_OWNERS = [
  { init: "AK", name: "Aki Kim" },
  { init: "LS", name: "Lena Shah" },
  { init: "MC", name: "Maya Chen" },
  { init: "PN", name: "Priya Nair" },
  { init: "MV", name: "Marcus Vale" },
  { init: "DO", name: "Dana Osei" },
  { init: "SO", name: "Sam Ortiz" },
];
const OWNER_OPTIONS = TASK_OWNERS.map((o, i) => ({ value: String(i), label: o.name }));
const TASK_DUES = [daysFromNow(3), daysFromNow(7), daysFromNow(14)];
const TASK_PRIS: [string, string][] = [
  ["High", "#B23A1E"],
  ["Medium", "#A05E1C"],
  ["Low", "#2C6E49"],
];

/** The two writes this panel offers. Optional: with neither, Run fact check and
    Create review task keep the local behaviour the canvas renders. */
export type FindingsActions = {
  /** Re-check the document's claims against the verified facts. Resolves to
      the number of contradictions found, which the panel reports. */
  runFactCheck?: () => Promise<number>;
  /** Open a review task on this document, assigned and dated by the row above
      the button. */
  createReviewTask?: (args: { assignee: string; due: string }) => void | Promise<void>;
};

export function DocReviewFindingsPanel({
  findings,
  claims,
  actions,
  defaultTab = "check",
  loading = false,
}: {
  findings: DocFinding[];
  claims: DocClaim[];
  actions?: FindingsActions;
  /** Which tab opens first, so each tab can be reviewed on its own. */
  defaultTab?: FactTab;
  loading?: boolean;
}) {
  const [tab, setTab] = useState<FactTab>(defaultTab);
  const [checking, setChecking] = useState(false);
  const [taskState, setTaskState] = useState<"idle" | "creating" | "done">("idle");
  const [ownerIx, setOwnerIx] = useState(0);
  const [dueIx, setDueIx] = useState(0);
  const [priIx, setPriIx] = useState(0);
  const [flashId, setFlashId] = useState<number | null>(null);
  /* The tally row is the claim filter: picking one narrows the claim list. */
  const [claimFilter, setClaimFilter] = useState<string | null>(null);
  const [checked, setChecked] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const contra = findings.find((f) => f.kind === "fact" && f.severity === "error") ?? null;
  const evidence = contra ? contra.note.replace(/^Contradicts verified fact:\s*/i, "") : "";
  const contradictionN = findings.filter((f) => f.kind === "fact" && f.severity === "error").length;
  const unsupportedN = findings.filter((f) => (f.kind === "fact" && f.severity !== "error") || f.kind === "freshness").length;
  /* XA-25: P-FA-1 removed status-dispatch-on-display-string from the Facts
     views and this panel kept it, so a workspace whose ledger spells the word
     "verified" or "VERIFIED" counted zero supported claims and drew a grey
     tick beside every verified one. Same normaliser the fact views use. */
  const supportedN = claims.filter(isVerifiedClaim).length;
  const allClaimsN = supportedN + contradictionN + unsupportedN;

  const runCheck = async () => {
    if (checking) return;
    setChecking(true);
    setFailed(null);
    if (!actions?.runFactCheck) {
      setTimeout(() => setChecking(false), 1400);
      return;
    }
    try {
      const found = await actions.runFactCheck();
      setChecked(found === 0
        ? "No contradictions found against the verified facts."
        : `${found} contradiction${found === 1 ? "" : "s"} recorded. Reopen the document to read them.`);
    } catch (e) {
      setFailed(why(e, "The fact check could not be run."));
    } finally {
      setChecking(false);
    }
  };

  const createTask = async () => {
    if (taskState !== "idle") return;
    setTaskState("creating");
    setFailed(null);
    if (!actions?.createReviewTask) {
      setTimeout(() => setTaskState("done"), 900);
      return;
    }
    try {
      await actions.createReviewTask({ assignee: TASK_OWNERS[ownerIx].name, due: TASK_DUES[dueIx].iso });
      setTaskState("done");
    } catch (e) {
      setTaskState("idle");
      setFailed(why(e, "That review task could not be created."));
    }
  };
  const jump = (id: number) => { setFlashId(id); setTimeout(() => setFlashId((f) => (f === id ? null : f)), 1200); };

  /* Overview-style tab row: label on top, count centered UNDERNEATH it, the
     whole cell clickable and wired to the claim list below. */
  const tallies: { n: number; label: string; status: string; tone: string; icon: React.ReactNode }[] = [
    { n: supportedN, label: "Supported", status: "Verified", tone: "text-moss", icon: <Check size={14} /> },
    { n: contradictionN, label: "Contradiction", status: "Contradicted", tone: "text-espelette", icon: <span className="font-bold">!</span> },
    { n: unsupportedN, label: "Unsupported", status: "Unsupported", tone: "text-clay", icon: <span className="font-bold">!</span> },
  ];

  const pickClaims = (status: string) => {
    setClaimFilter((f) => (f === status ? null : status));
    setTab("claims");
  };

  const shownClaims = claimFilter ? claims.filter((c) => c.status === claimFilter) : claims;

  const pickBtn = "flex w-full items-center justify-between gap-2";

  if (loading) {
    return (
      <Card variant="flush" className="w-full">
        <div className="flex gap-4 px-4 pt-4" aria-hidden="true">
          <SkeletonLine w={70} h={11} /><SkeletonLine w={80} h={11} />
        </div>
        <div className="flex items-stretch border-b border-ink/10 px-4 py-3.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <Fragment key={i}>
              {i > 0 && <span className="mx-3 w-px bg-ink/12" />}
              <span className="flex-1 space-y-1.5"><SkeletonLine w="70%" h={10} /><Skeleton width={24} height={20} /></span>
            </Fragment>
          ))}
        </div>
        <div className="px-4 py-3" aria-hidden="true"><Skeleton height={34} rounded="rounded-[4px]" /></div>
        <div className="space-y-3 px-4 pb-4" aria-hidden="true">
          <div className="rounded-[6px] border border-ink/12 p-3 space-y-2.5">
            <SkeletonLine w="45%" h={11} /><SkeletonText lines={2} /><SkeletonLine w="60%" h={10} />
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <Skeleton height={34} rounded="rounded-[4px]" /><Skeleton height={34} rounded="rounded-[4px]" /><Skeleton height={34} rounded="rounded-[4px]" />
          </div>
          <Skeleton width={132} height={28} rounded="rounded-[4px]" />
        </div>
      </Card>
    );
  }

  return (
    <Card variant="flush" className="w-full">
      <div className="px-4 pt-4">
        <Tabs<FactTab>
          value={tab}
          onChange={setTab}
          ariaLabel="Fact check"
          variant="underline"
          options={[
            { id: "check", label: "Fact check" },
            { id: "claims", label: "All claims", count: allClaimsN },
          ]}
        />
      </div>

      {/* tally row, doubling as the claim filter */}
      <div className="flex items-stretch border-b border-ink/10 px-4 py-3.5">
        {tallies.map((t, i) => {
          const on = claimFilter === t.status;
          return (
            <Fragment key={t.label}>
              {i > 0 && <span className="mx-2 w-px bg-ink/12" />}
              <button
                type="button"
                aria-pressed={on}
                onClick={() => pickClaims(t.status)}
                className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-[5px] border px-1.5 py-1.5 text-center transition-colors ${
                  on ? "border-biscay-2 bg-biscay-2/[0.08] ring-1 ring-biscay-2" : "border-transparent hover:border-ink/20"
                }`}
              >
                <span className={`flex max-w-full items-center justify-center gap-1.5 text-[11.5px] font-medium ${t.tone}`}>
                  {t.icon}
                  <span className="truncate">{t.label}</span>
                </span>
                <Truncate as="b" className="font-display text-[20px] leading-tight text-ink">{t.n}</Truncate>
              </button>
            </Fragment>
          );
        })}
      </div>

      <div className="px-4 py-3">
        <Button block disabled={checking} onClick={runCheck}>
          <ShieldCheck size={14} /> {checking ? "Checking claims against verified facts…" : "Run fact check"}
        </Button>
        {checked && <p className="mt-1.5 text-[11.5px] text-ink/70">{checked}</p>}
        {/* Both writes on this panel report here, and neither accuses an input,
            so the failure is a banner rather than a field caption (XA-02). */}
        <WriteError onDismiss={() => setFailed(null)}>{failed}</WriteError>
      </div>

      {tab === "claims" ? (
        <div className="pb-4">
          {/* Count above the list, filter clause included (CONVENTIONS §13). */}
          <ResultCount
            from={1} to={shownClaims.length} total={shownClaims.length} noun="claims"
            note={claimFilter ? `filtered to ${claimFilter.toLowerCase()}, ${claims.length} in total` : undefined}
            className="border-t"
            actions={claimFilter && (
              /* Not a <ShowRest>: this resets the tally filter rather than
                 expanding a capped list, and "Show all" read like the expand
                 toggle it is not. */
              <Button variant="link" compact onClick={() => setClaimFilter(null)}>Clear filter</Button>
            )}
          />
          {/* A long document yields hundreds of claims: the list scrolls in a
              bounded box with a visible bar, it does not run off the rail
              (CONVENTIONS §20). */}
          <Scrollable axis="y" className="max-h-[420px]" scrollerClassName="space-y-2 px-4 pt-3">
            {shownClaims.map((f, i) => (
              <div key={`${f.claim}-${i}`} className="flex items-start gap-2.5">
                <span className={`mt-0.5 shrink-0 ${isVerifiedClaim(f) ? "text-moss" : "text-ink/65"}`}>
                  <CheckCircle2 size={15} />
                </span>
                <span className="min-w-0 flex-1 text-[13px] text-ink/85">
                  <Truncate lines={3}>{f.claim}</Truncate>
                  <Truncate className="mt-0.5 text-[11px] text-ink/65">
                    {f.source} · {f.status} · {f.verified}
                  </Truncate>
                </span>
              </div>
            ))}
            {shownClaims.length === 0 && (
              <p className="text-[12.5px] text-ink/70">
                {claims.length === 0
                  ? "No claims extracted yet. Run a fact check to scan the document."
                  : "No claims in this state."}
              </p>
            )}
          </Scrollable>
        </div>
      ) : (
        <div className="px-4 pb-4">
          {contra ? (
            <div className="rounded-[6px] border border-espelette/25 bg-espelette/[0.04] p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-espelette">
                  <span className="grid place-items-center w-4 h-4 rounded-full bg-espelette text-white text-[10px] font-bold">!</span>
                  Contradiction
                </span>
                <span className="text-[11px] text-ink/65">High confidence</span>
              </div>
              <div className="mt-2.5">
                <span className="block text-[10.5px] uppercase tracking-[0.06em] text-ink/65">In document</span>
                <mark
                  className={`mt-1 inline-block max-w-full cursor-pointer break-words rounded-[3px] bg-espelette/15 px-1 py-0.5 text-[12.5px] text-ink/85 transition-colors ${flashId === contra.id ? "ring-2 ring-espelette/50" : ""}`}
                  onClick={() => jump(contra.id)}
                >{contra.text}</mark>
              </div>
              <div className="mt-2.5">
                <span className="block text-[10.5px] uppercase tracking-[0.06em] text-ink/65">Verified evidence</span>
                <mark className="mt-1 inline-block max-w-full break-words rounded-[3px] bg-moss/15 px-1 py-0.5 text-[12.5px] text-ink/85">{evidence}</mark>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px] text-ink/65">
                <FileText size={13} /> Auth RFC v1.2 · {fmtDate("2024-05-01")}
                <StatusChip status="canonical" />
                <Button variant="link" className="ml-auto" onClick={() => window.open("/knowledge?q=Auth%20RFC", "_blank")}>
                  Open source <ArrowRight size={11} />
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-[12.5px] text-ink/65">No contradictions found. Run a fact check to scan the latest claims.</div>
          )}

          {/* create-task row: owner, priority, due date on ONE line in that
              order (CONVENTIONS.md §7), primary action bottom left (§2). */}
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            <div className="min-w-0">
              <span className="block text-[11px] text-ink/65">Owner</span>
              <div className="mt-1">
                <Combobox
                  ariaLabel="Task owner"
                  search
                  value={String(ownerIx)}
                  onChange={(v) => setOwnerIx(Number(v))}
                  options={OWNER_OPTIONS}
                  searchPlaceholder="Search people…"
                  emptyLabel="No people match"
                />
              </div>
            </div>
            <div className="min-w-0">
              <span className="block text-[11px] text-ink/65">Priority</span>
              <div className="mt-1">
                <Menu align="start" trigger={(
                  <Button className={pickBtn}>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="inline-block h-2 w-2 shrink-0 rounded-[1px]" style={{ background: TASK_PRIS[priIx][1] }} />
                      <span className="truncate">{TASK_PRIS[priIx][0]}</span>
                    </span>
                    <ChevronDown size={12} className="shrink-0" />
                  </Button>
                )}>
                  <MenuRadioGroup value={String(priIx)} onValueChange={(v) => setPriIx(Number(v))}>
                    {TASK_PRIS.map(([label], i) => <MenuRadioItem key={label} value={String(i)}>{label}</MenuRadioItem>)}
                  </MenuRadioGroup>
                </Menu>
              </div>
            </div>
            <div className="min-w-0">
              <span className="block text-[11px] text-ink/65">Due date</span>
              <div className="mt-1">
                <Menu align="start" trigger={(
                  <Button className={pickBtn}>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Calendar size={13} className="shrink-0" />
                      <span className="truncate">{TASK_DUES[dueIx].label}</span>
                    </span>
                    <ChevronDown size={12} className="shrink-0" />
                  </Button>
                )}>
                  <MenuRadioGroup value={String(dueIx)} onValueChange={(v) => setDueIx(Number(v))}>
                    {TASK_DUES.map((d, i) => <MenuRadioItem key={d.iso} value={String(i)}>{d.label}</MenuRadioItem>)}
                  </MenuRadioGroup>
                </Menu>
              </div>
            </div>
          </div>

          <CardActions
            className="mt-3"
            /* XA-23: this was the one "Create review task" drawn without its
               ClipboardCheck and with a shorter done word ("Task created") than
               the three Lineage drawers used. One component owns all of it. */
            primary={
              <CreateReviewTaskButton
                compact
                state={taskState === "done" ? "done" : taskState === "creating" ? "busy" : "idle"}
                onClick={createTask}
              />
            }
          />
        </div>
      )}
    </Card>
  );
}
