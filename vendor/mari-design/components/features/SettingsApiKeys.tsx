import { useState } from "react";
import { Plus, KeyRound } from "lucide-react";
import { PageHeader } from "../layout/PageHeader";
import { Card } from "../layout/Card";
import { Button } from "../actions/Button";
import { ConfirmButton } from "../actions/ConfirmButton";
import { Input } from "../forms/Input";
import { Field } from "../forms/Field";
import { Checkbox } from "../forms/Checkbox";
import { Chip } from "../data-display/Chip";
import { EmptyState } from "../data-display/EmptyState";
import { TokenReveal as TokenRevealUI, TOKEN_REVEAL_WARNING } from "../data-display/TokenReveal";

/** What is true of the KEYS LIST, as opposed to a secret on screen. */
const KEYS_LIST_HINT = "Keys are rate limited individually, and revocation takes effect immediately.";
import { SortHeader, useSort, tdPad } from "../data-display/sortable";
import { SkeletonButton, SkeletonTable } from "../data-display/Skeleton";
import { Truncate } from "../data-display/Truncate";
import { Scrollable } from "../data-display/Scrollable";
import { PagerBar, ResultCount, usePaged } from "../data-display/Pagination";
import { fmtDate } from "../tokens/format";
import { useWrite } from "../actions/useWrite";
import { WriteError } from "../feedback/WriteError";
import { useResync } from "../actions/useResync";

/* Settings — API keys ─────────────────────────────────────────────────────
   Create and revoke programmatic-access keys (CI, bots, the MCP gateway).
   Keys show only a masked prefix in the table; the full secret is revealed
   exactly once after creation via TokenReveal. Revocation is immediate.
   Source: web/src/pages/settings/ApiKeys.tsx. Standalone — the "created"
   secret is a locally generated demo string, no network. */

export type ApiKey = {
  id: number;
  name: string;
  prefix: string;
  scopes: string;
  created: string;
  lastUsed: string | null;
  revoked: boolean;
};

/** The scopes a key can carry. The rail beside this table has always
    documented exactly these four, while the form asked for them as free text
    (P-SK-1) — so the one place that knew the vocabulary could not offer it,
    and a typo produced a key with a scope nothing grants. */
export const API_SCOPES: { id: string; blurb: string }[] = [
  { id: "search:read", blurb: "Query the index" },
  { id: "ingest:write", blurb: "Push documents" },
  { id: "facts:read", blurb: "Read verified facts" },
  { id: "metrics:read", blurb: "Export usage" },
];

/** Scopes are stored as a space-separated string; the checkboxes are a view
    onto it. A scope this build has never heard of survives a round trip
    because it is kept in the list rather than dropped on parse. */
const parseScopes = (s: string): string[] => s.split(/[\s,]+/).filter(Boolean);

function randomSecret(): string {
  const hex = Array.from({ length: 32 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
  return `mk_live_${hex}`;
}

/** What the API-keys surface can DO.

    `createKey` RETURNS the secret because that is the only moment it exists:
    the server mints it, hands it back once, and stores a hash. Nothing here
    ever re-reads a secret, and nothing logs one. */
export type SettingsApiKeysActions = {
  createKey?: (draft: { name: string; scopes: string }) => string | Promise<string>;
  revokeKey?: (id: number) => void | Promise<void>;
};

export type SettingsApiKeysProps = {
  /** Hide the internal PageHeader when the host page already renders one. */
  embedded?: boolean;
  keys: ApiKey[];
  actions?: SettingsApiKeysActions;
  /** Whether the create form is open. Embedded, the host page owns the
      "Create key" button, so it owns this. */
  createOpen?: boolean;
  /** What the create form starts with, when the host page already knows (a
      retried creation, a deep link). Scopes are the stored space-separated
      string; anything in it that this build has no checkbox for is kept, not
      dropped. */
  draft?: { name: string; scopes: string };
  onCreateOpenChange?: (open: boolean) => void;
  /** Pin one row's Revoke into its armed "Revoke?" step, and show a token as
      if it had just been minted. Canvas only, and for the same reason
      `createOpen` is controllable: a state worth reviewing has to be reachable
      without clicking through to it. */
  confirmRevokeId?: number | null;
  revealToken?: string | null;
  loading?: boolean;
  className?: string;
};

export function SettingsApiKeys({
  keys: initialKeys, actions, createOpen, onCreateOpenChange, draft,
  confirmRevokeId = null, revealToken = null,
  loading = false, embedded = false, className = "",
}: SettingsApiKeysProps) {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys);
  const [creatingLocal, setCreatingLocal] = useState(false);
  const creating = createOpen ?? creatingLocal;
  const setCreating = (open: boolean) => { setCreatingLocal(open); onCreateOpenChange?.(open); };
  const [name, setName] = useState(draft?.name ?? "");
  const [scopes, setScopes] = useState<string[]>(
    draft?.scopes ? parseScopes(draft.scopes) : ["search:read"],
  );
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState<string | null>(revealToken);

  /* The list is seeded from a prop, and `useState` reads its seed once, so
     after a refetch this table kept rendering the first response (C1). */
  useResync(initialKeys, setKeys);

  /* The same bug on the two props the first sentinel missed. `revealToken` is
     the one that mattered: the page hands the freshly minted secret down after
     the create round-trips, and a token read once at mount meant the panel
     showed nothing — the only time this secret is ever displayable. The create
     form holds while the reader is filling it in. Both props come off the
     memoised page data in `web/src/data/settings.ts`; `draft` is compared by
     its two fields because the page rebuilds that small object inline. */
  useResync(revealToken, setToken);
  useResync(draft, (d) => {
    setName(d?.name ?? "");
    setScopes(d?.scopes ? parseScopes(d.scopes) : ["search:read"]);
  }, { hold: creating || saving, key: `${draft?.name ?? ""}\u0000${draft?.scopes ?? ""}` });

  /* Create and revoke both go through `write`: with no `actions` they are the
     local-state changes this panel has always made (which is what the design
     canvas renders), and with actions they are the server's answer. */
  const write = useWrite();

  const createKey = async () => {
    const keyName = name.trim();
    if (!keyName || scopes.length === 0) return;
    const eff = scopes.join(" ");
    setSaving(true);
    // The secret comes from the server when there is one, and from here only
    // when there is not. Either way it is shown once and never re-read.
    const secret = actions?.createKey
      ? await write.runFor(() => actions.createKey!({ name: keyName, scopes: eff }))
      : randomSecret();
    setSaving(false);
    if (!secret) return;
    setKeys((k) => [...k, { id: Math.max(0, ...k.map((x) => x.id)) + 1, name: keyName, prefix: `${secret.slice(0, 12)}…`, scopes: eff, created: new Date().toISOString().slice(0, 10), lastUsed: null, revoked: false }]);
    setToken(secret);
    setName(""); setScopes(["search:read"]); setCreating(false);
  };

  /* Destructive: the caller is <ConfirmButton>, so this is the second click. */
  const revoke = (id: number) => write.run(
    actions?.revokeKey && (() => actions.revokeKey!(id)),
    () => setKeys((k) => k.map((x) => (x.id === id ? { ...x, revoked: true } : x))),
  );

  const { sort, onSort, sorted } = useSort(keys, {
    name: (k) => k.name,
    key: (k) => k.prefix,
    scopes: (k) => k.scopes,
    created: (k) => k.created,
    lastUsed: (k) => k.lastUsed ?? "",
    status: (k) => (k.revoked ? "Revoked" : "Active"),
  });

  /* CI fleets mint keys by the hundred; the table pages rather than growing
     the card past the fold (CONVENTIONS §13). */
  const pager = usePaged(sorted, 12);

  /* The header copy and the seven column names are this feature's own
     literals — they were greyed out with the rows, so a loading Settings page
     was a nameless title bar over a nameless grid, and every column resized
     when its real name arrived. What is unknown is which keys exist. */
  if (loading) {
    return (
      <div className={`flex flex-col gap-5 ${className}`.trim()} aria-busy="true">
        {!embedded && <PageHeader
          title="API keys"
          description="Programmatic access for CI, bots, and the MCP gateway"
          actions={<SkeletonButton w={110} />}
        />}
        <Card variant="flush" title="Keys" hint={KEYS_LIST_HINT}>
          <SkeletonTable rows={4} columns={["Name", "Key", "Scopes", "Created", "Last used", "Status", "Actions"]} className="border-0 rounded-none" />
        </Card>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-5 ${className}`.trim()}>
      {!embedded && <PageHeader
        title="API keys"
        description="Programmatic access for CI, bots, and the MCP gateway"
        actions={<Button variant="primary" onClick={() => setCreating(!creating)}><Plus size={15} /> Create key</Button>}
      />}

      <WriteError onDismiss={() => write.setFailed(null)}>{write.failed}</WriteError>

      {creating && (
        <Card title="New key" hint={TOKEN_REVEAL_WARNING}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="CI pipeline" className="w-full" /></Field>
            <Field label="Scopes">
              {/* Pick from what the server actually grants, rather than typing
                  a scope string and finding out later (P-SK-1). */}
              <div className="flex flex-col gap-2 pt-1">
                {API_SCOPES.map((s) => (
                  <Checkbox
                    key={s.id}
                    checked={scopes.includes(s.id)}
                    onCheckedChange={(on) => setScopes((c) => (on ? [...c, s.id] : c.filter((x) => x !== s.id)))}
                    label={<span className="flex min-w-0 items-baseline gap-2"><span className="font-term text-[12.5px] text-ink">{s.id}</span><span className="text-[12px] text-ink/70">{s.blurb}</span></span>}
                  />
                ))}
                {/* A scope the draft carried that this build has no row for is
                    still shown and still saved: dropping it silently would
                    narrow a key nobody asked to narrow. */}
                {scopes.filter((s) => !API_SCOPES.some((a) => a.id === s)).map((s) => (
                  <Checkbox
                    key={s}
                    checked
                    onCheckedChange={(on) => setScopes((c) => (on ? c : c.filter((x) => x !== s)))}
                    label={<span className="font-term text-[12.5px] text-ink">{s}</span>}
                  />
                ))}
              </div>
            </Field>
          </div>
          {scopes.length === 0 && <p className="mt-2 text-[12px] text-ink/70">Choose at least one scope. A key with none can do nothing.</p>}
          <div className="mt-3 flex items-center gap-2">
            <Button variant="primary" disabled={saving || !name.trim() || scopes.length === 0} onClick={() => void createKey()}>{saving ? "Creating…" : "Create key"}</Button>
            <Button onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {token && <TokenRevealUI token={token} title="Your new key" onDismiss={() => setToken(null)} />}

      {/* The one-time-reveal warning is about a secret being shown RIGHT NOW,
          so it lives on <TokenReveal> and on the create form — not permanently
          over a list of keys that shows nothing but masked prefixes. */}
      <Card variant="flush" title="Keys" hint={KEYS_LIST_HINT}>
        {keys.length === 0 ? (
          <EmptyState icon={<KeyRound size={24} />} title="No keys yet">Create the first one above to give CI or an agent programmatic access.</EmptyState>
        ) : (
          /* table-fixed so the colgroup widths hold: under auto layout a
             100-character token let the Key column collapse to ~70px and wrap
             one character per line. The table keeps its 720px floor and
             scrolls inside this card. */
          <>
          <ResultCount from={pager.from} to={pager.to} total={pager.total} noun="keys"
            note={`${keys.filter((k) => k.revoked).length} revoked`} />
          <Scrollable>
            <table className="w-full table-fixed text-left border-collapse" style={{ minWidth: 720 }}>
              {/* Percentages made every column a share of a width nobody
                  controls: STATUS landed at 94px and rendered an ALL-CAPS chip
                  as "ACT…"/"REV…" — two states truncated into the same
                  ambiguous stub — while "Last used" wrapped to three lines. The
                  columns that hold FIXED-SIZE FURNITURE (a formatted date, a
                  status chip, a Revoke button) are sized in px; only the three
                  text columns flex, because they are the only ones whose
                  content can honestly absorb the slack. Same rule as
                  SettingsMembersTable. */}
              <colgroup>
                <col /><col /><col />
                <col style={{ width: "8rem" }} /><col style={{ width: "8rem" }} />
                <col style={{ width: "7.5rem" }} /><col style={{ width: "7rem" }} />
              </colgroup>
              <thead>
                <tr>
                  <SortHeader label="Name" sortKey="name" sort={sort} onSort={onSort} />
                  <SortHeader label="Key" sortKey="key" sort={sort} onSort={onSort} />
                  <SortHeader label="Scopes" sortKey="scopes" sort={sort} onSort={onSort} />
                  <SortHeader label="Created" sortKey="created" sort={sort} onSort={onSort} align="center" />
                  <SortHeader label="Last used" sortKey="lastUsed" sort={sort} onSort={onSort} align="center" />
                  {/* Rows carry a clickable action, so status is second to last. */}
                  <SortHeader label="Status" sortKey="status" sort={sort} onSort={onSort} />
                  <SortHeader label="Actions" sortable={false} />
                </tr>
              </thead>
              <tbody>
                {pager.pageRows.map((k) => (
                  <tr key={k.id} className={`border-b border-ink/10 last:border-0 align-top ${k.revoked ? "bg-flysch/60" : ""}`}>
                    <td className={tdPad}><Truncate className="text-[13px] font-medium text-ink">{k.name}</Truncate></td>
                    {/* A key is opaque: truncate with the full value on hover
                        rather than wrapping a token down the column. */}
                    <td className={tdPad}><Truncate className="font-term text-[12px] text-ink/70">{k.prefix}</Truncate></td>
                    <td className={tdPad}><Truncate className="font-term text-[12px] text-ink/70">{k.scopes}</Truncate></td>
                    <td className={`${tdPad} text-center font-term text-[12px] text-ink/65`}>{fmtDate(k.created)}</td>
                    <td className={`${tdPad} text-center font-term text-[12px] text-ink/65`}>{k.lastUsed ? fmtDate(k.lastUsed) : "Never"}</td>
                    <td className={tdPad}><Chip label={k.revoked ? "Revoked" : "Active"} tone={k.revoked ? "blocked" : "ok"} dot caps /></td>
                    <td className={`${tdPad} whitespace-nowrap`}>{!k.revoked && <ConfirmButton compact confirmLabel="Revoke?" defaultArmed={k.id === confirmRevokeId} onConfirm={() => revoke(k.id)}>Revoke</ConfirmButton>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scrollable>
          {pager.paged && <PagerBar page={pager.page} pageCount={pager.pageCount} onChange={pager.setPage} />}
          </>
        )}
      </Card>
    </div>
  );
}
