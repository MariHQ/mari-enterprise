import { useMemo, useState } from "react";
import { UserPlus, Search } from "lucide-react";
import { PageHeader } from "../layout/PageHeader";
import { Card } from "../layout/Card";
import { Button } from "../actions/Button";
import { ConfirmButton } from "../actions/ConfirmButton";
import { Input } from "../forms/Input";
import { Select } from "../forms/Select";
import { Field } from "../forms/Field";
import { Avatar } from "../data-display/Avatar";
import { Chip } from "../data-display/Chip";
import { Skeleton, SkeletonLine, SkeletonButton, SkeletonCard, SkeletonTable } from "../data-display/Skeleton";
import { useWrite } from "../actions/useWrite";
import { WriteError } from "../feedback/WriteError";
import { SortHeader, useSort, tdPad } from "../data-display/sortable";
import { EmptyState } from "../data-display/EmptyState";
import { Scrollable } from "../data-display/Scrollable";
import { PagerBar, ResultCount, usePaged } from "../data-display/Pagination";
import { fmtDate } from "../tokens/format";
import { GithubMark } from "../icons/marks";
import { Truncate, TruncateInline } from "../data-display/Truncate";
import { useResync } from "../actions/useResync";

/* Settings — Members table & provisioning ────────────────────────────────
   Manage who can access the workspace: invite teammates, list members with
   inline role editing and removal, edit the workspace name, and configure
   member provisioning (GitHub team sync + a static provisioning card).
   Composes PageHeader, Card, Avatar, Chip, Select, ConfirmButton.
   Source: web/src/pages/settings/Members.tsx. Pure presenter: the roster, the
   workspace name and the GitHub team all arrive as required props; mutations
   are local state (no network). */

const ROLES = ["admin", "manager", "user"] as const;
type Role = (typeof ROLES)[number] | string;

export type Member = {
  id: number;
  name: string;
  initials: string;
  email: string;
  role: Role;
  status: string;
  joined: string;
};

/** The GitHub team members are auto-provisioned from. */
export type GithubTeamSync = { connected: boolean; team: string };

/** Role ids are lowercase on the wire; the dropdown shows them Capitalized
    (CONVENTIONS.md §7). */
const ROLE_LABEL: Record<string, string> = { admin: "Admin", manager: "Manager", user: "User" };
const roleLabel = (r: Role) => ROLE_LABEL[r] ?? (String(r).charAt(0).toUpperCase() + String(r).slice(1));

/** What the members surface can DO. One handler per intent the admin has, all
    optional: with none the controls keep the local behaviour below, which is
    what the design canvas renders. Handlers may throw; the message is shown. */
export type SettingsMembersActions = {
  inviteMember?: (invite: { name: string; email: string; role: string }) => void | Promise<void>;
  setRole?: (id: number, role: string) => void | Promise<void>;
  removeMember?: (id: number) => void | Promise<void>;
  setWorkspaceName?: (name: string) => void | Promise<void>;
  setGithubTeam?: (team: string) => void | Promise<void>;
};

export type SettingsMembersTableProps = {
  /** Hide the internal PageHeader when the host page already renders one. */
  embedded?: boolean;
  members: Member[];
  workspaceName: string;
  githubTeam: GithubTeamSync;
  actions?: SettingsMembersActions;
  /** Whether the invite composer is open. Embedded, the host page owns the
      "Invite member" button, so it owns this; standalone, the panel's own
      header button drives it and both may be omitted. */
  inviteOpen?: boolean;
  onInviteOpenChange?: (open: boolean) => void;
  /** Pin one row's Remove into its armed "Remove?" step. Canvas only, for the
      same reason `inviteOpen` is controllable: a state worth reviewing has to
      be reachable without a click. */
  confirmRemoveId?: number | null;
  /** Fired once the server has taken an invitation, so the host page can say
      so where its own header can see it. The page used to depend on the
      adapter setting an `interaction` field it never set (P-SM-2). */
  onInvited?: (invite: { name: string; email: string; role: string }) => void;
  loading?: boolean;
  className?: string;
};

export function SettingsMembersTable({
  members: initialMembers,
  workspaceName,
  githubTeam,
  actions,
  inviteOpen,
  onInviteOpenChange,
  confirmRemoveId = null,
  onInvited,
  loading = false,
  embedded = false,
  className = "",
}: SettingsMembersTableProps) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [invitingLocal, setInvitingLocal] = useState(false);
  const inviting = inviteOpen ?? invitingLocal;
  const setInviting = (open: boolean) => { setInvitingLocal(open); onInviteOpenChange?.(open); };
  const [invName, setInvName] = useState("");
  const [invEmail, setInvEmail] = useState("");
  const [invRole, setInvRole] = useState<Role>("user");
  const [sending, setSending] = useState(false);

  const [name, setName] = useState(workspaceName);
  const [nameDraft, setNameDraft] = useState(workspaceName);
  const [editingName, setEditingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  /* The roster is seeded from a prop and `useState` reads its seed once, so
     after a refetch this table kept rendering the first response (C1). */
  useResync(initialMembers, setMembers);

  const [gh, setGh] = useState(githubTeam);
  const [ghDraft, setGhDraft] = useState(githubTeam.team);
  const [ghEditing, setGhEditing] = useState(false);

  /* Same bug, two fields the first sentinel did not cover: the workspace name
     and the GitHub team were also read once, so renaming the workspace in
     another tab left this row showing the old name indefinitely. Both hold
     while their inline editor is open — adopting mid-rename would delete what
     the reader had typed. `web/src/data/settings.ts` memoises the mapped page
     data on the raw query answer, so both props are referentially stable. */
  useResync(workspaceName, (n) => { setName(n); setNameDraft(n); }, { hold: editingName });
  useResync(githubTeam, (t) => { setGh(t); setGhDraft(t.team); }, { hold: ghEditing });
  const ghConnected = gh.connected && Boolean(gh.team);

  /* Every mutator below goes through `write`: with no `actions` it is the same
     local-state change this panel has always made, and with actions it is that
     change applied only after the server accepted it (actions/useWrite.ts). */
  const write = useWrite();

  const sendInvite = async () => {
    const name = invName.trim();
    const email = invEmail.trim();
    if (!name || !email) return;
    setSending(true);
    const ok = await write.run(
      actions?.inviteMember && (() => actions.inviteMember!({ name, email, role: String(invRole) })),
      () => {
        const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
        setMembers((m) => [...m, { id: Math.max(0, ...m.map((x) => x.id)) + 1, name, initials, email, role: invRole, status: "invited", joined: new Date().toISOString().slice(0, 10) }]);
      },
    );
    setSending(false);
    if (ok) {
      onInvited?.({ name, email, role: String(invRole) });
      setInvName(""); setInvEmail(""); setInvRole("user"); setInviting(false);
    }
  };

  const changeRole = (id: number, role: Role) => write.run(
    actions?.setRole && (() => actions.setRole!(id, String(role))),
    () => setMembers((m) => m.map((x) => (x.id === id ? { ...x, role } : x))),
  );

  /* Destructive, so the caller is <ConfirmButton> and this only ever runs on
     the second click (CONVENTIONS §2). */
  const remove = (id: number) => write.run(
    actions?.removeMember && (() => actions.removeMember!(id)),
    () => setMembers((m) => m.filter((x) => x.id !== id)),
  );

  const saveName = async () => {
    const next = nameDraft.trim();
    if (!next) return;
    const ok = await write.run(
      actions?.setWorkspaceName && (() => actions.setWorkspaceName!(next)),
      () => { setName(next); setNameSaved(true); setTimeout(() => setNameSaved(false), 1600); },
    );
    if (ok) setEditingName(false);
  };

  const saveGh = async () => {
    const team = ghDraft.trim();
    const ok = await write.run(
      actions?.setGithubTeam && (() => actions.setGithubTeam!(team)),
      // `connected` is the server's own judgement (a team AND a credential to
      // read it with), so the echo only claims what this panel can know: the
      // team it just set. A reload replaces it with the server's answer.
      () => setGh((g) => ({ connected: actions?.setGithubTeam ? g.connected : true, team })),
    );
    if (ok) setGhEditing(false);
  };

  const roleOptions = (r: Role): Role[] => (ROLES.includes(r as never) ? [...ROLES] : [r, ...ROLES]);

  /* A workspace with hundreds of members needs a way to find one. The table
     declared a "many" state and shipped nothing to manage it (P-SM-1): the
     pager below was the only volume control, so reaching one person meant
     paging through everyone. Filter options are sentence case (§3). */
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) =>
      (!q || `${m.name} ${m.email}`.toLowerCase().includes(q))
      && (!roleFilter || String(m.role) === roleFilter));
  }, [members, query, roleFilter]);
  const narrowed = query.trim().length > 0 || roleFilter !== "";

  const { sort, onSort, sorted } = useSort(shown, {
    member: (m) => m.name,
    email: (m) => m.email,
    role: (m) => roleLabel(m.role),
    joined: (m) => m.joined,
    status: (m) => m.status,
  });

  /* A real workspace has hundreds of members. Rendering them all grew this
     card past 15,000px and buried the provisioning cards below it, so the
     table pages and says how many people there really are (§13, §20). */
  const pager = usePaged(sorted, 12);

  /* The panel names itself, its table's six columns and its two footer cards
     without asking the server anything. The DESCRIPTION is the exception:
     "Manage who can reach {name}" interpolates the workspace's name, so it
     waits rather than being printed with a hole in it. */
  if (loading) {
    return (
      <div className={`flex flex-col gap-5 ${className}`.trim()} aria-busy="true">
        {!embedded && <PageHeader title="Admin" actions={<SkeletonButton w={130} />} />}
        {!embedded && <SkeletonLine w={280} h={13} className="-mt-3" />}
        <Card variant="flush" title="Members" hint="Everyone who can reach this workspace">
          <SkeletonTable rows={4} columns={["Member", "Email", "Role", "Joined", "Status", "Actions"]} className="border-0 rounded-none" />
        </Card>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <SkeletonCard title="GitHub team sync" lines={2} />
          <SkeletonCard title="Provisioning" lines={3} />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-5 ${className}`.trim()}>
      {!embedded && <PageHeader
        title="Admin"
        description={`Manage who can reach ${name}, and how they get in`}
        actions={<Button variant="primary" onClick={() => setInviting(!inviting)}><UserPlus size={15} /> Invite member</Button>}
      />}

      {/* One failure surface for all five writes on this panel: whichever one
          the server rejected says why, in the server's own words (§8). */}
      <WriteError onDismiss={() => write.setFailed(null)}>{write.failed}</WriteError>

      {inviting && (
        <Card title="Invite a teammate" hint="They appear below with an Invited chip until they sign in.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Name"><Input value={invName} onChange={(e) => setInvName(e.target.value)} placeholder="Jordan Lee" className="w-full" /></Field>
            <Field label="Email"><Input type="email" value={invEmail} onChange={(e) => setInvEmail(e.target.value)} placeholder="jordan@team.com" className="w-full" /></Field>
            <Field label="Role"><Select value={invRole} onChange={(e) => setInvRole(e.target.value)} className="w-full">{ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}</Select></Field>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button variant="primary" disabled={sending || !invName.trim() || !invEmail.trim()} onClick={() => void sendInvite()}>{sending ? "Sending…" : "Send invite"}</Button>
            <Button onClick={() => setInviting(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      <Card eyebrow="Workspace name" actions={
        editingName ? (
          <>
            <Button compact variant="primary" disabled={write.busy} onClick={() => void saveName()}>Save</Button>
            <Button compact onClick={() => { setNameDraft(name); setEditingName(false); }}>Cancel</Button>
          </>
        ) : <Button compact onClick={() => { setNameDraft(name); setEditingName(true); }}>Edit</Button>
      }>
        {editingName
          ? <Input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} className="w-full max-w-[360px]" />
          : <div className="flex min-w-0 flex-wrap items-center gap-3"><Truncate className="min-w-0 flex-1 basis-[12rem] font-display text-[20px] font-semibold text-ink">{name}</Truncate>{nameSaved && <span className="shrink-0 font-term text-[11.5px] text-moss">✓ Saved</span>}</div>}
      </Card>

      {/* The row count lives in the result strip below the header, once
          (CONVENTIONS §13), so the hint describes instead of counting. */}
      <Card variant="flush" title="Members" hint="Everyone who can reach this workspace" actions={
        <>
          <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-[4px] border border-ink/20 bg-paper focus-within:border-biscay-2 focus-within:ring-1 focus-within:ring-biscay-2/40">
            <Search size={13} className="text-ink/65" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search members…"
              aria-label="Search members"
              className="w-[160px] bg-transparent text-[12.5px] text-ink placeholder:text-ink/65 outline-none"
            />
          </div>
          <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filter by role" className="h-8">
            <option value="">All roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
          </Select>
        </>
      }>
        {members.length === 0 ? (
          <EmptyState title="No members yet">Send the first invite to bring someone into this workspace.</EmptyState>
        ) : shown.length === 0 ? (
          <EmptyState title="No matches">No member matches that search or role.</EmptyState>
        ) : (
          /* table-fixed so the colgroup widths are binding: with auto layout a
             single unbreakable email collapsed the address column to ~80px and
             stacked it a character at a time. The table keeps its 760px floor
             and scrolls inside this card instead. */
          <>
          <ResultCount from={pager.from} to={pager.to} total={pager.total} noun="members"
            note={narrowed ? `filtered from ${members.length.toLocaleString("en-US")}` : undefined} />
          <Scrollable>
            {/* The four right-hand columns hold fixed-size furniture — a role
                select, a formatted date, a status chip, a Remove button — and
                none of them gets narrower just because the card does. As
                percentages they did: at this card's width STATUS was 98px, so
                the chip truncated to "ACTI…", which could be ACTIVE or
                ACTIONED, and JOINED broke "Jan 18, 2025" across three lines.
                They are px now and only the two text columns flex; below the
                760px floor the table scrolls (§20) instead of crushing (§12). */}
            <table className="w-full table-fixed text-left border-collapse" style={{ minWidth: 760 }}>
              <colgroup>
                <col /><col /><col style={{ width: "8.5rem" }} />
                <col style={{ width: "8rem" }} /><col style={{ width: "7.5rem" }} /><col style={{ width: "7rem" }} />
              </colgroup>
              <thead>
                <tr>
                  <SortHeader label="Member" sortKey="member" sort={sort} onSort={onSort} />
                  <SortHeader label="Email" sortKey="email" sort={sort} onSort={onSort} />
                  <SortHeader label="Role" sortKey="role" sort={sort} onSort={onSort} align="center" />
                  <SortHeader label="Joined" sortKey="joined" sort={sort} onSort={onSort} align="center" />
                  {/* Rows carry a clickable action, so status is second to last. */}
                  <SortHeader label="Status" sortKey="status" sort={sort} onSort={onSort} />
                  <SortHeader label="Actions" sortable={false} />
                </tr>
              </thead>
              <tbody>
                {pager.pageRows.map((m) => (
                  <tr key={m.id} className="border-b border-ink/10 last:border-0 align-top">
                    <td className={tdPad}>
                      <span className="flex items-start gap-2.5">
                        <Avatar initials={m.initials} />
                        <Truncate className="min-w-0 flex-1 text-[13px] font-medium text-ink">{m.name}</Truncate>
                      </span>
                    </td>
                    <td className={tdPad}><Truncate className="text-[13px] text-ink/70">{m.email}</Truncate></td>
                    <td className={`${tdPad} text-center`}>
                      <Select aria-label={`Role for ${m.name}`} value={m.role} onChange={(e) => changeRole(m.id, e.target.value)} className="h-8 w-full">
                        {roleOptions(m.role).map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                      </Select>
                    </td>
                    <td className={`${tdPad} text-center font-term text-[12px] text-ink/65`}>{fmtDate(m.joined)}</td>
                    <td className={tdPad}><Chip label={m.status === "invited" ? "Invited" : "Active"} tone={m.status === "invited" ? "attention" : "ok"} dot caps /></td>
                    <td className={`${tdPad} whitespace-nowrap`}><ConfirmButton compact confirmLabel="Remove?" defaultArmed={m.id === confirmRemoveId} onConfirm={() => remove(m.id)}>Remove</ConfirmButton></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scrollable>
          {pager.paged && <PagerBar page={pager.page} pageCount={pager.pageCount} onChange={pager.setPage} />}
          </>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card icon={<GithubMark size={16} />} title="GitHub team sync" actions={
          ghEditing ? <><Button compact variant="primary" disabled={write.busy} onClick={() => void saveGh()}>Save</Button><Button compact onClick={() => { setGhDraft(gh.team); setGhEditing(false); }}>Cancel</Button></>
            : <Button compact onClick={() => { setGhDraft(gh.team); setGhEditing(true); }}>Configure</Button>
        }>
          {ghEditing ? (
            <Field label="Team slug"><Input value={ghDraft} onChange={(e) => setGhDraft(e.target.value)} placeholder="org/team" className="w-full font-term" /></Field>
          ) : (
            <p className="min-w-0 text-[13px] text-ink/70">
              {ghConnected ? <>Members of <TruncateInline className="font-term text-ink">{gh.team}</TruncateInline> are auto-provisioned as they sign in.</> : <span className="text-ink/70">Not connected. Configure a team to auto-provision members.</span>}
            </p>
          )}
        </Card>

        <Card title="Provisioning">
          <ul className="flex flex-col gap-2.5">
            <li className="flex items-center justify-between"><span className="text-[13px] text-ink/80">Manual invites</span><Chip label="On" tone="ok" caps /></li>
            <li className="flex items-center justify-between"><span className="text-[13px] text-ink/80">GitHub team</span><Chip label={ghConnected ? "Connected" : "Off"} tone={ghConnected ? "ok" : "neutral"} caps /></li>
            <li className="flex items-center justify-between"><span className="text-[13px] text-ink/80">SCIM</span><Chip label="Enterprise" tone="info" caps /></li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
