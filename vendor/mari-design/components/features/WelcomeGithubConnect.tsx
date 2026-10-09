import { useState } from "react";
import { GitFork, Lock, ArrowRight, CheckCircle2 } from "lucide-react";
import { Drawer } from "../layout/Drawer";
import { Button } from "../actions/Button";
import { Alert } from "../feedback/Alert";
import { Field } from "../forms/Field";
import { Input } from "../forms/Input";
import { Chip } from "../data-display/Chip";
import { Skeleton, SkeletonLine, SkeletonCircle, SkeletonChip, SkeletonButton } from "../data-display/Skeleton";
import { SyncPanel, type SyncSource } from "../feedback/SyncPanel";
import { GithubMark } from "../icons/marks";
import { Scrollable } from "../data-display/Scrollable";
import { focusRing } from "../tokens/focusRing";

/* WelcomeGithubConnect — the Welcome wizard's GitHub sub-flow: pick a repo from
   the token-scoped list, set a paths glob, connect (creates a source), then
   watch the first sync in a live <SyncPanel>. Shares the exact repo-picker →
   connect → sync shape as the Sources ConnectorWizard. The local RepoPicker is
   built here (a filterable single-select radio list); githubRepos /
   connectGithubRepo / syncStatus are baked in. Standalone: opens by default. */

const DEFAULT_PATHS = "**/*.md";

type Repo = { fullName: string; description: string; private: boolean; defaultBranch: string; connected: boolean };

const REPOS: Repo[] = [
  { fullName: "acme/handbook", description: "Company handbook & policies", private: true, defaultBranch: "main", connected: false },
  { fullName: "acme/api-docs", description: "Public API reference", private: false, defaultBranch: "main", connected: false },
  { fullName: "acme/design-system", description: "Component library docs", private: true, defaultBranch: "main", connected: true },
  { fullName: "acme/runbooks", description: "On-call runbooks", private: true, defaultBranch: "master", connected: false },
  { fullName: "acme/blog", description: "Engineering blog (Markdown)", private: false, defaultBranch: "main", connected: false },
];

function RepoPicker({
  repos, selected, onSelect,
}: { repos: Repo[]; selected: string | null; onSelect: (name: string) => void }) {
  const [filter, setFilter] = useState("");
  const q = filter.trim().toLowerCase();
  const shown = repos.filter((r) => !q || r.fullName.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
  return (
    <div>
      <Input className="w-full mb-2" placeholder="Filter repositories…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      {shown.length === 0 ? (
        <p className="text-[12.5px] text-ink/70 py-3">No repositories match "{filter}".</p>
      ) : (
        <Scrollable axis="y" className="max-h-[300px]">
          <div role="radiogroup" aria-label="Repositories" className="grid grid-cols-1 gap-1.5">
            {shown.map((r) => {
              const active = selected === r.fullName;
              return (
                <label
                  key={r.fullName}
                  className={`flex items-center gap-2.5 p-2.5 rounded-md border cursor-pointer transition-colors ${focusRing} ${
                    r.connected ? "cursor-not-allowed border-ink/12 bg-flysch text-ink/70" : active ? "border-biscay-2 ring-1 ring-biscay-2/40 bg-biscay/[0.04]" : "border-ink/15 hover:border-ink/35"
                  }`}
                >
                  <input type="radio" name="wc-repo" className="accent-biscay" disabled={r.connected} checked={active} onChange={() => onSelect(r.fullName)} />
                  <GitFork size={14} className="text-ink/65 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <b className="min-w-0 break-all text-[13px] font-semibold text-ink">{r.fullName}</b>
                      {r.private && <Chip label="Private" tone="neutral" icon={<Lock size={10} />} />}
                    </span>
                    <span className="block break-words text-[11.5px] text-ink/70 line-clamp-2">{r.description}</span>
                  </span>
                  {r.connected
                    ? <Chip label="Connected" tone="ok" className="shrink-0" />
                    : <span className="shrink-0 font-term text-[11px] text-ink/65">{r.defaultBranch}</span>}
                </label>
              );
            })}
          </div>
        </Scrollable>
      )}
    </div>
  );
}

export type WelcomeGithubConnectProps = {
  repos?: Repo[];
  defaultOpen?: boolean;
  loading?: boolean;
  className?: string;
};

/* Loading silhouette mirroring the GitHub connect panel: provider header, a
   filter field, the repo radio list, and a paths-glob field. */
function GithubConnectSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <div className="flex items-start gap-3">
        <SkeletonCircle size={44} />
        <div className="min-w-0 flex-1 space-y-2 pt-1">
          <SkeletonLine w="42%" h={14} />
          <SkeletonLine w="70%" h={10} />
        </div>
      </div>
      <div className="mt-5 space-y-2">
        <Skeleton height={34} />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2.5 rounded-md border border-ink/15 p-2.5">
            <SkeletonCircle size={14} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <SkeletonLine w="45%" h={11} />
              <SkeletonLine w="68%" h={9} />
            </div>
            <SkeletonChip w={48} />
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-1.5">
        <SkeletonLine w={110} h={10} />
        <Skeleton height={38} />
      </div>
      <div className="mt-4 flex items-center gap-3 border-t border-ink/10 pt-3">
        <SkeletonLine w="40%" h={10} />
        <span className="ml-auto"><SkeletonButton w={130} /></span>
      </div>
    </div>
  );
}

export function WelcomeGithubConnect({ repos = REPOS, defaultOpen = true, loading = false, className = "" }: WelcomeGithubConnectProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [repo, setRepo] = useState<string | null>(null);
  const [paths, setPaths] = useState(DEFAULT_PATHS);
  const [sync, setSync] = useState<SyncSource | null>(null);
  const [landed, setLanded] = useState<string | null>(null);

  const reset = () => { setRepo(null); setPaths(DEFAULT_PATHS); setSync(null); };

  const connect = () => {
    if (!repo) return;
    const running: SyncSource = {
      id: "github", name: `GitHub · ${repo}`, provider: "github",
      state: "syncing", phase: "Fetching", done: 30, total: 240, chunkCount: 410, embeddedCount: 90,
    };
    setSync(running);
    window.setTimeout(() => setSync({
      ...running, state: "done", phase: undefined,
      docCount: 240, chunkCount: 3180, embeddedCount: 3180, lastSyncAt: new Date().toISOString(),
    }), 1600);
  };

  const connected = sync != null;
  /* Primary action bottom LEFT, supporting copy to its right (§2). */
  const footer = connected ? (
    <div className="flex-1 flex items-center gap-3">
      <Button variant="primary" onClick={() => { setOpen(false); setLanded(repo); reset(); }}>Done <CheckCircle2 size={14} /></Button>
      <span className="text-[12px] text-ink/70">Sync continues on the server. Closing will not interrupt it.</span>
    </div>
  ) : (
    <div className="flex-1 flex items-center gap-3">
      <Button variant="primary" disabled={!repo} onClick={connect}>Connect and sync <ArrowRight size={14} /></Button>
      <span className="text-[12px] text-ink/70">Mari syncs Markdown docs read-only.</span>
    </div>
  );

  if (loading) return <GithubConnectSkeleton className={className} />;

  return (
    <div className={className}>
      <Button variant="primary" onClick={() => { reset(); setOpen(true); }}><GithubMark size={15} /> Connect GitHub</Button>
      {landed && !open && (
        <div className="mt-3">
          <Alert tone="info" title="Source connected" onDismiss={() => setLanded(null)}
            action={<Button compact onClick={() => setLanded(null)}>Open Connectors</Button>}>
            GitHub · {landed} now lives on Sources, under the Connectors tab. Its first sync keeps running there.
          </Alert>
        </div>
      )}
      <Drawer open={open} onClose={() => { setOpen(false); reset(); }} title="Connect GitHub" subtitle="Connector setup"
        icon={<GithubMark size={20} />} footer={footer}>
        {connected ? (
          <>
            <p className="text-[13px] text-ink/70 mb-3">The initial sync runs on the server. Live status below.</p>
            <SyncPanel sources={[sync!]} onRetry={() => setSync((s) => (s ? { ...s, state: "syncing" } : s))} />
          </>
        ) : (
          <>
            <p className="text-[13px] text-ink/70 mb-3">Pick a repository from your token's scope, then optionally narrow to a paths glob.</p>
            <RepoPicker repos={repos} selected={repo} onSelect={(n) => setRepo(n)} />
            <div className="mt-3">
              <Field label="Paths filter (glob)">
                <Input className="w-full font-term" value={paths} onChange={(e) => setPaths(e.target.value)} placeholder={DEFAULT_PATHS} />
              </Field>
            </div>
          </>
        )}
      </Drawer>
    </div>
  );
}
