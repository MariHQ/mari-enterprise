import { useMemo, useState, type ReactNode } from "react";
import {
  Check, X, ChevronDown, Languages, Tag, User, Layers, Sparkles, RotateCw,
} from "lucide-react";
import { Button } from "../actions/Button";
import { Card } from "../layout/Card";
import { Combobox } from "../forms/Combobox";
import { Switch } from "../forms/Switch";
import { Progress } from "../data-display/Progress";
import { CountChip } from "../data-display/Chip";
import { EmptyState } from "../data-display/EmptyState";
import { Truncate } from "../data-display/Truncate";
import { Skeleton, SkeletonLine, SkeletonCard } from "../data-display/Skeleton";
import { WriteError } from "../feedback/WriteError";
import { ResultCount } from "../data-display/Pagination";
import { ShowRest } from "../data-display/ShowRest";
import { why } from "../actions/useWrite";
import { card } from "../tokens/card";
import { focusRing } from "../tokens/focusRing";
import type { ScanRun } from "./ScanRunCard";

/* Audit findings checklist — the core of the repo-audit page: scan findings
   grouped by kind, each a checklist row you fix or dismiss until the run
   clears. A summary strip jumps to sections; a progress header tracks
   handled/total with a Hide-handled switch; per-kind sections collapse and
   support Fix all; rows carry kind-specific fix controls. Fixes degrade to
   local overrides (offline-resilient). Renders standalone with baked findings. */

type Kind = "Localization" | "Tags" | "Authorship" | "Coverage" | "Hygiene";
type FixAction = "apply_tag" | "invite_member" | "translation_task" | "link_translation" | "ingest" | "hygiene_task";
type FindingStatus = "open" | "fixed" | "dismissed";

export type AuditFinding = {
  id: number;
  kind: Kind;
  title: string;
  detail: string;
  fixAction: FixAction;
  fixPayload?: { tag?: string; suggest?: string } | null;
  status: FindingStatus;
};

const KIND_ORDER: Kind[] = ["Localization", "Tags", "Authorship", "Coverage", "Hygiene"];
const KIND_ICON: Record<Kind, ReactNode> = {
  Localization: <Languages size={14} />, Tags: <Tag size={14} />, Authorship: <User size={14} />,
  Coverage: <Layers size={14} />, Hygiene: <Sparkles size={14} />,
};
const FIX_LABEL: Record<FixAction, string> = {
  apply_tag: "Apply tag", invite_member: "Map to member",
  translation_task: "Create translation task", link_translation: "Link as translation",
  ingest: "Index it", hygiene_task: "Create task",
};

type Override = { status: "fixed"; summary: string } | { status: "dismissed" };

/** What the checklist can DO. Every handler may throw and the row (or the
    section, or the Re-audit button) shows the message where the click was.
    All optional: without them the checklist keeps the local overrides it has
    always applied, which is what the design canvas renders. */
export type AuditActions = {
  /** Re-scan the repository as a background run, and answer with the run so
      the page can follow it through <ScanRunCard> — the same card, poll and
      vocabulary Facts and Decisions use for their own scans, so the three
      cannot drift (P-AU-1). A handler that only succeeds keeps the older
      fire-and-forget behaviour. Without one, no Re-audit button is drawn: the
      page used to sleep 700ms and call that a scan (§2). */
  runAudit?: (provider: string) => ScanRun | Promise<ScanRun> | void | Promise<void>;
  /** Re-read a run this page started. Polled until the run stops running;
      without it the page shows the run once and does not follow it. */
  scanProgress?: (id: string) => ScanRun | Promise<ScanRun>;
  /** Open a past run from the history rail. Without it the rail's rows are not
      clickable and carry no hover affordance (§2, P-AU-2). */
  openRun?: (id: string) => void;
  /** Apply a finding's one-click fix. `memberName` maps an unmapped author. */
  fixFinding?: (args: { id: number; memberName?: string }) => void | Promise<void>;
  /** Apply the one-click fix to every open finding of one kind. */
  fixAllFindings?: (args: { kind: string }) => void | Promise<void>;
  /** Take a finding off the list without fixing it. */
  dismissFinding?: (id: number) => void | Promise<void>;
};

export type AuditFindingsChecklistProps = {
  findings: AuditFinding[];
  /** Side effects the checklist offers. Omitted = local overrides only. */
  actions?: AuditActions;
  /** The people an unmapped git author can be mapped to. */
  members: { id: number; name: string }[];
  /** Start a re-scan. The PAGE owns the run and follows it; the checklist only
      asks for one, so the two cannot report different things about the same
      scan. Omitted = no Re-audit button (§2). */
  onReaudit?: () => void;
  /** A scan the page started is still going. */
  scanning?: boolean;
  /** Why the last scan could not be started, from the page that tried. */
  scanError?: string | null;
  /** Render a content-shaped skeleton while the scan runs. */
  loading?: boolean;
  className?: string;
};

export function AuditFindingsChecklist({
  findings, members, actions, onReaudit,
  scanning = false, scanError = null, loading = false, className = "",
}: AuditFindingsChecklistProps) {
  const [overrides, setOverrides] = useState<Record<number, Override>>({});
  const [hideHandled, setHideHandled] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<Kind>>(new Set());
  const [pulse, setPulse] = useState<Kind | null>(null);
  const [pick, setPick] = useState<Record<number, string>>({});
  const [rowErr, setRowErr] = useState<Record<number, string>>({});
  const [kindErr, setKindErr] = useState<Partial<Record<Kind, string>>>({});
  const [fixingKind, setFixingKind] = useState<Kind | null>(null);
  /* A repo audit routinely returns 200+ findings in one kind. Each section
     shows a screenful and names the real remainder, rather than rendering a
     10,000px column of checklist rows (CONVENTIONS §13, §15). */
  const [expandedKind, setExpandedKind] = useState<Set<Kind>>(new Set());
  const PER_SECTION = 8;

  const statusOf = (f: AuditFinding): FindingStatus => overrides[f.id]?.status ?? f.status;

  const byKind = useMemo(() => {
    const m = new Map<Kind, AuditFinding[]>();
    for (const k of KIND_ORDER) {
      const rows = findings.filter((f) => f.kind === k).sort((a, b) => Math.abs(a.id) - Math.abs(b.id));
      if (rows.length) m.set(k, rows);
    }
    return m;
  }, [findings]);

  const openCount = (k: Kind) => (byKind.get(k) ?? []).filter((f) => statusOf(f) === "open").length;
  const total = findings.length;
  const handled = findings.filter((f) => statusOf(f) !== "open").length;

  /* Optimistic: the row settles on the click, because the checklist is a list
     you work down. A rejected write puts the row back and says why, in place. */
  const fixFinding = async (f: AuditFinding, memberName?: string) => {
    setOverrides((o) => ({ ...o, [f.id]: { status: "fixed", summary: memberName ? `Mapped to ${memberName}` : summaryFor(f) } }));
    setRowErr((e) => { const n = { ...e }; delete n[f.id]; return n; });
    if (!actions?.fixFinding) return;
    try {
      await actions.fixFinding({ id: f.id, memberName });
    } catch (err) {
      setOverrides((o) => { const n = { ...o }; delete n[f.id]; return n; });
      setRowErr((e) => ({ ...e, [f.id]: why(err, "That fix did not apply.") }));
    }
  };

  const dismiss = async (f: AuditFinding) => {
    setOverrides((o) => ({ ...o, [f.id]: { status: "dismissed" } }));
    setRowErr((e) => { const n = { ...e }; delete n[f.id]; return n; });
    if (!actions?.dismissFinding) return;
    try {
      await actions.dismissFinding(f.id);
    } catch (err) {
      setOverrides((o) => { const n = { ...o }; delete n[f.id]; return n; });
      setRowErr((e) => ({ ...e, [f.id]: why(err, "That finding could not be dismissed.") }));
    }
  };

  const fixAll = async (k: Kind) => {
    const open = (byKind.get(k) ?? []).filter((f) => statusOf(f) === "open");
    setOverrides((o) => {
      const next = { ...o };
      for (const f of open) next[f.id] = { status: "fixed", summary: summaryFor(f) };
      return next;
    });
    setKindErr((e) => { const n = { ...e }; delete n[k]; return n; });
    if (!actions?.fixAllFindings) return;
    setFixingKind(k);
    try {
      await actions.fixAllFindings({ kind: k });
    } catch (err) {
      setOverrides((o) => { const n = { ...o }; for (const f of open) delete n[f.id]; return n; });
      setKindErr((e) => ({ ...e, [k]: why(err, "Those fixes did not apply.") }));
    } finally {
      setFixingKind(null);
    }
  };

  const jumpTo = (k: Kind) => {
    setCollapsed((c) => { const n = new Set(c); n.delete(k); return n; });
    setPulse(k);
    setTimeout(() => setPulse(null), 1400);
  };

  /* A repo audit walks the whole tree, so the run belongs to the page, which
     follows it and shows its progress. The checklist only asks for one and
     drops the overrides it was laying over the old run's rows. It used to run
     its own scan with `await new Promise(r => setTimeout(r, 700))` behind it —
     a button that reported a scan nobody had run (P-AU-1). */
  const reaudit = () => {
    if (scanning || !onReaudit) return;
    setOverrides({});
    onReaudit();
  };

  const toggle = (k: Kind) => setCollapsed((c) => { const n = new Set(c); n.has(k) ? n.delete(k) : n.add(k); return n; });

  if (loading) {
    return (
      <div className={`flex flex-col gap-5 ${className}`} aria-hidden="true">
        <div className="space-y-2">
          <SkeletonLine w={130} h={10} />
          <Skeleton width={140} height={20} />
          <SkeletonLine w={280} h={10} />
        </div>
        <div className="flex flex-wrap gap-2">
          {[110, 92, 118, 96, 104].map((w, i) => <Skeleton key={i} width={w} height={38} rounded="rounded-[6px]" />)}
        </div>
        <Skeleton height={58} className="rounded-md" />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={3} />
        <SkeletonCard lines={2} />
      </div>
    );
  }

  if (findings.length === 0) {
    return (
      <div className={className}>
        <Card variant="flush">
          <EmptyState
            icon={<Layers size={26} />}
            title="No audits yet"
            action={onReaudit && (
              <Button variant="primary" disabled={scanning} onClick={reaudit}>
                <RotateCw size={14} className={scanning ? "animate-spin" : ""} /> {scanning ? "Scanning…" : "Run first audit"}
              </Button>
            )}
          >
            Run a repository audit to see findings grouped by kind.
          </EmptyState>
        </Card>
        {/* XA-02: a scan that would not start is a refused ACTION, not a caption
            under the empty state's prose. Banner, outside the box, so the empty
            state keeps saying only "nothing here yet". */}
        <WriteError>{scanError}</WriteError>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-5 ${className}`}>
      {/* No page header here. The PAGE names the run — same repo, same
          provider, same date — and this used to restate all three under a
          second <PageHeader>, so Repository audit opened on two stacked
          headers and, on mobile, on nothing else. The checklist is a section
          of that page, not another page. */}

      {/* Summary strip. Re-audit rides this line, right of the kind chips,
          not floating alone in the header above them. */}
      <div className="flex flex-wrap items-center gap-2">
        {[...byKind.keys()].map((k) => {
          const open = openCount(k);
          return (
            <button
              key={k} type="button" onClick={() => jumpTo(k)}
              className={`${card} inline-flex items-center gap-2 px-3 py-2 transition-colors hover:border-ink/30 ${open === 0 ? "opacity-60" : ""} ${focusRing}`}
            >
              <span className="text-ink/70">{KIND_ICON[k]}</span>
              <b className="font-term text-[15px] tabular-nums text-ink">{open}</b>
              <span className="text-[12.5px] text-ink/70">{k}</span>
            </button>
          );
        })}
        {onReaudit && (
          <div className="ml-auto">
            <Button variant="primary" disabled={scanning} onClick={reaudit}>
              <RotateCw size={14} className={scanning ? "animate-spin" : ""} /> {scanning ? "Scanning…" : "Re-audit"}
            </Button>
          </div>
        )}
      </div>
      <WriteError>{scanError}</WriteError>

      {/* Progress header */}
      <div className={`${card} flex flex-wrap items-center gap-4 px-4 py-3`}>
        <div className="min-w-[200px] flex-1">
          <div className="mb-1.5 text-[13px] text-ink/70"><b className="text-ink">{handled}</b> of <b className="text-ink">{total}</b> handled</div>
          <Progress value={total ? (handled / total) * 100 : 0} tone={handled === total ? "ok" : "info"} />
        </div>
        <Switch checked={hideHandled} onCheckedChange={setHideHandled} label="Hide handled" />
      </div>

      {/* Grouped sections */}
      {[...byKind.entries()].map(([k, rows]) => {
        const isCollapsed = collapsed.has(k);
        const open = openCount(k);
        const visible = hideHandled ? rows.filter((f) => statusOf(f) === "open") : rows;
        const showAll = expandedKind.has(k);
        const shown = showAll ? visible : visible.slice(0, PER_SECTION);
        const hidden = visible.length - shown.length;
        return (
          <Card key={k} variant="flush" className={pulse === k ? "ring-2 ring-biscay-2/40 transition-shadow" : ""}>
            <div className="flex items-center gap-3 px-4 py-3">
              <button type="button" onClick={() => toggle(k)} aria-expanded={!isCollapsed} className={`grid h-6 w-6 place-items-center rounded-[4px] text-ink/70 hover:bg-flysch ${focusRing}`}>
                <ChevronDown size={16} className={`transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
              </button>
              <span className="text-ink/70">{KIND_ICON[k]}</span>
              <span className="text-[14px] font-semibold text-ink">{k}</span>
              <CountChip count={open} tone={open === 0 ? "ok" : "attention"} />
              <span className="flex-1" />
              {!isCollapsed && open > 0 && (
                <Button variant="link" disabled={fixingKind === k} onClick={() => void fixAll(k)}>
                  {fixingKind === k ? "Fixing…" : "Fix all"}
                </Button>
              )}
            </div>
            {kindErr[k] && (
              /* A refused "Fix all" names no input, so it is a banner beside the
                 control that fired (XA-02). */
              <div className="px-4 pb-3">
                <WriteError onDismiss={() => setKindErr((e) => { const n = { ...e }; delete n[k]; return n; })}>{kindErr[k]}</WriteError>
              </div>
            )}

            {!isCollapsed && (
              <div className="border-t border-ink/10">
                {visible.length === 0 ? (
                  <div className="flex items-center gap-2 px-4 py-3 text-[12.5px] text-moss"><Check size={14} /> All handled.</div>
                ) : (
                  <>
                  {/* The count rule (§13, Pagination.tsx): this section header
                      carries the count because the section COLLAPSES, so
                      `whenTruncated` keeps the strip quiet until it has
                      something the header cannot say — that these rows are a
                      slice of a longer list. It used to print "2 findings"
                      under a header chip already reading ②, five times on one
                      screen. */}
                  <ResultCount
                    whenTruncated
                    from={visible.length === 0 ? 0 : 1}
                    to={shown.length}
                    total={visible.length}
                    noun="findings"
                    actions={(hidden > 0 || showAll) && (
                      <ShowRest
                        expanded={showAll}
                        total={visible.length}
                        onToggle={() => setExpandedKind((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; })}
                      />
                    )}
                  />
                  <ul className="divide-y divide-ink/10">
                    {shown.map((f) => {
                      const st = statusOf(f);
                      const ov = overrides[f.id];
                      return (
                        <li key={f.id} className="flex items-start gap-3 px-4 py-3">
                          <StatusMarker status={st} />
                          <div className="min-w-0 flex-1">
                            <Truncate lines={2} className="text-[13.5px] font-medium text-ink">{f.title}</Truncate>
                            <Truncate lines={2} className="mt-0.5 text-[12.5px] leading-snug text-ink/70">{f.detail}</Truncate>
                            {st === "fixed" && <div className="mt-1 font-term text-[11.5px] text-moss">→ {ov && "summary" in ov ? ov.summary : summaryFor(f)}</div>}
                            {st === "dismissed" && <div className="mt-1 font-term text-[11.5px] text-ink/65">dismissed</div>}
                            {rowErr[f.id] && (
                              /* A rejected fix accuses no input on the row, so it
                                 gets the same banner every other refused write
                                 gets (XA-02). */
                              <div className="mt-1.5">
                                <WriteError onDismiss={() => setRowErr((e) => { const n = { ...e }; delete n[f.id]; return n; })}>{rowErr[f.id]}</WriteError>
                              </div>
                            )}
                          </div>
                          {st === "open" && (
                            <div className="flex max-w-[45%] shrink-0 flex-wrap items-center justify-end gap-1.5 [&_*]:max-w-full [&_button]:[overflow-wrap:anywhere]">
                              {fixControl(f, members, pick[f.id] ?? "", (v) => setPick((p) => ({ ...p, [f.id]: v })), (x, m) => void fixFinding(x, m))}
                              <button type="button" aria-label="Dismiss finding" title="Dismiss" onClick={() => void dismiss(f)} className={`grid h-7 w-7 place-items-center rounded-[4px] text-ink/65 hover:bg-flysch hover:text-ink ${focusRing}`}>
                                <X size={14} />
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  </>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function summaryFor(f: AuditFinding): string {
  switch (f.fixAction) {
    case "apply_tag": return `Tagged '${f.fixPayload?.tag ?? f.fixPayload?.suggest ?? "tag"}'`;
    case "translation_task": return "Translation task created";
    case "link_translation": return "Linked to source translation";
    case "ingest": return "Indexed";
    case "hygiene_task": return "Task created";
    case "invite_member": return "Author mapped";
  }
}

/* A square checkbox-shaped marker, never a circle: a round marker reads as
   "choose one of these", and these are states, not options (CONVENTIONS §6). */
function StatusMarker({ status }: { status: FindingStatus }) {
  const base = "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[4px] border";
  if (status === "fixed") {
    return <span className={`${base} border-moss/60 bg-moss/[0.10] text-moss`} title="Fixed"><Check size={13} strokeWidth={2.8} /></span>;
  }
  if (status === "dismissed") {
    return <span className={`${base} border-ink/25 bg-ink/[0.04] text-ink/65`} title="Dismissed"><X size={12} strokeWidth={2.4} /></span>;
  }
  return <span className={`${base} border-ink/35 bg-paper`} title="Open" aria-hidden />;
}

function fixControl(
  f: AuditFinding,
  members: { id: number; name: string }[],
  picked: string,
  onPick: (v: string) => void,
  fix: (f: AuditFinding, memberName?: string) => void,
) {
  if (f.fixAction === "apply_tag") {
    const tag = f.fixPayload?.tag ?? f.fixPayload?.suggest ?? "tag";
    return <Button compact onClick={() => fix(f)}>Apply “{tag}”</Button>;
  }
  if (f.fixAction === "invite_member") {
    return (
      <span className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
        {/* A member picker is always a searchable combobox (CONVENTIONS §7). */}
        <span className="w-[190px] max-w-full">
          <Combobox
            ariaLabel="Map to member"
            placeholder="Map to member"
            searchPlaceholder="Search members"
            value={picked || null}
            onChange={onPick}
            options={members.map((m) => ({ value: m.name, label: m.name }))}
          />
        </span>
        <Button compact disabled={!picked} onClick={() => fix(f, picked)}>Map</Button>
        <Button variant="link" onClick={() => fix(f)}>Invite as new</Button>
      </span>
    );
  }
  return <Button compact onClick={() => fix(f)}>{FIX_LABEL[f.fixAction]}</Button>;
}
