import { useState, type ReactNode } from "react";
import { Check, ExternalLink, Plus, Send } from "lucide-react";
import type { PageModule, PageProps } from "./types";
import { PageFrame, navFor } from "./PageFrame";
import { PageHeader } from "../layout/PageHeader";
import { Card } from "../layout/Card";
import { Button } from "../actions/Button";
import { Input } from "../forms/Input";
import { Field } from "../forms/Field";
import { Chip } from "../data-display/Chip";
import { EmptyState } from "../data-display/EmptyState";
import { SkeletonPage } from "../data-display/Skeletons";
import { ReadError } from "../feedback/ReadError";
import { WriteError } from "../feedback/WriteError";
import { Spinner } from "../data-display/Spinner";
import { Tabs, type TabOption } from "../navigation/Tabs";
import { Link } from "../navigation/Link";
import { card } from "../tokens/card";
import { focusRing } from "../tokens/focusRing";
import { useWrite } from "../actions/useWrite";
import { useResync } from "../actions/useResync";
import { PublishMcpServers, type McpServer, type PublishMcpActions } from "../features/PublishMcpServers";
import { SourcesBots, type GithubStatus, type SlackStatus, type SourcesBotsActions } from "../features/SourcesBots";

/** Destinations deliberately contains only live delivery mechanisms. Static
 * documentation generation is not part of this product surface. */
export type PublishSection = "chat" | "mcp" | "bots";
export type PublishView = "chat" | "mcp-list" | "mcp-add" | "mcp-token" | "bots";

export type McpDraft = { name: string; scope: string; capabilities: unknown[]; toolCount: number };
export type McpCreated = { name: string; scopeLabel: string; toolCount: number; token: string; snippet: string };
export type KnowledgeChatDestination = {
  id: number; name: string; slug: string; title: string; welcome: string;
  status: "draft" | "live"; url: string;
  tools: string[];
};

export type PublishActions = PublishMcpActions & SourcesBotsActions & {
  openSection?: (section: PublishSection) => void;
  openKnowledgeChat?: (id: number) => void;
  createKnowledgeChat?: (args: { name: string; slug: string; title: string; welcome: string; tools: string[] }) => void | Promise<void>;
  updateKnowledgeChat?: (id: number, args: { name: string; title: string; welcome: string; tools: string[] }) => void | Promise<void>;
  deployKnowledgeChat?: (id: number) => void | Promise<void>;
};

export type PublishData = {
  view: PublishView;
  servers: McpServer[];
  serverCount: number;
  draft: McpDraft;
  created: McpCreated;
  chats: KnowledgeChatDestination[];
  selectedChatId: number | null;
  slack: SlackStatus;
  github: GithubStatus;
};

const TABS: TabOption<PublishSection>[] = [
  { id: "chat", label: "Knowledge chat" },
  { id: "mcp", label: "MCP servers" },
  { id: "bots", label: "Bots" },
];

const SECTION: Record<PublishView, PublishSection> = {
  chat: "chat", "mcp-list": "mcp", "mcp-add": "mcp", "mcp-token": "mcp", bots: "bots",
};

const STATES = [
  { id: "default", label: "Knowledge chat" },
  { id: "mcp", label: "MCP · Server list" },
  { id: "mcp-add", label: "MCP · Add server" },
  { id: "mcp-token", label: "MCP · Token created" },
  { id: "mcp-empty", label: "MCP · Empty" },
  { id: "bots", label: "Bots" },
  { id: "loading", label: "Loading" },
  { id: "error", label: "Error" },
] as const;

function KnowledgeChats({ chats, selectedId, actions }: {
  chats: KnowledgeChatDestination[]; selectedId: number | null; actions?: PublishActions;
}) {
  const selected = chats.find((row) => row.id === selectedId) ?? null;
  const [creating, setCreating] = useState(chats.length === 0);
  const [name, setName] = useState(selected?.name ?? "");
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState(selected?.title ?? "");
  const [welcome, setWelcome] = useState(selected?.welcome ?? "");
  const [tools, setTools] = useState<string[]>(selected?.tools ?? ["search", "facts", "answers"]);
  const write = useWrite();
  useResync(selected, (row) => {
    setName(row?.name ?? ""); setTitle(row?.title ?? ""); setWelcome(row?.welcome ?? "");
    setTools(row?.tools ?? ["search", "facts", "answers"]);
  });

  if (!creating && !selected) return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div><h2 className="text-[18px] font-semibold text-ink">Knowledge chat</h2>
          <p className="mt-1 text-[13px] text-ink/70">Deploy a project-scoped assistant that answers from approved knowledge and cites its sources.</p></div>
        <Button onClick={() => setCreating(true)}><Plus size={14} /> New knowledge chat</Button>
      </div>
      {chats.length === 0 ? <EmptyState title="No knowledge chats yet">Create an interactive search and answer destination for your team.</EmptyState> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{chats.map((chat) => (
          <button key={chat.id} type="button" onClick={() => actions?.openKnowledgeChat?.(chat.id)}
            className={`${card} ${focusRing} p-4 text-left hover:border-moss/50`}>
            <span className="flex items-center justify-between gap-2"><strong className="text-[14px] text-ink">{chat.name}</strong><Chip label={chat.status === "live" ? "Live" : "Draft"} tone={chat.status === "live" ? "ok" : "neutral"} /></span>
            <span className="mt-2 block font-term text-[12px] text-ink/60">/{chat.slug}</span>
          </button>
        ))}</div>
      )}
    </div>
  );

  const save = async () => {
    if (creating) {
      const ok = await write.run(actions?.createKnowledgeChat && (() => actions.createKnowledgeChat!({ name, slug, title, welcome, tools })));
      if (ok) setCreating(false);
    } else if (selected) {
      await write.run(actions?.updateKnowledgeChat && (() => actions.updateKnowledgeChat!(selected.id, { name, title, welcome, tools })));
    }
  };
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-[18px] font-semibold text-ink">{creating ? "New knowledge chat" : selected?.name}</h2>
        <p className="mt-1 text-[13px] text-ink/70">Answers use approved knowledge and cited retrieval for this project.</p></div>
        <Button compact onClick={() => { setCreating(false); actions?.openSection?.("chat"); }}>All chats</Button></div>
      <WriteError onDismiss={() => write.setFailed(null)}>{write.failed}</WriteError>
      <Card className="flex flex-col gap-4 p-5">
        <Field label="Destination name"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Company knowledge" /></Field>
        {creating ? <Field label="URL slug"><Input value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} placeholder="company-knowledge" /><span className="text-[12px] text-ink/70">Lowercase letters, numbers, and hyphens.</span></Field>
          : <Field label="Destination URL"><Input readOnly value={selected?.url ?? ""} /></Field>}
        <Field label="Assistant title"><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ask Acme" /></Field>
        <Field label="Welcome message"><Input value={welcome} onChange={(event) => setWelcome(event.target.value)} placeholder="What would you like to know?" /></Field>
        <fieldset><legend className="text-[12px] font-semibold text-ink">Knowledge tools</legend>
          <p className="mt-1 text-[12px] text-ink/65">Choose the direct reads this assistant may make for each answer.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">{[
            ["search", "Search documents"], ["facts", "Verified facts"], ["answers", "Approved answers"],
          ].map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded border border-ink/15 p-2 text-[12px]"><input type="checkbox" checked={tools.includes(key)} onChange={() => setTools((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])} />{label}</label>)}</div>
        </fieldset>
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={write.busy || !name.trim() || !title.trim() || tools.length === 0 || (creating && !slug.trim())} onClick={() => void save()}>{write.busy ? <Spinner size="sm" /> : <Check size={14} />} {creating ? "Create knowledge chat" : "Save configuration"}</Button>
          {!creating && selected && <Button disabled={write.busy} onClick={() => void write.run(actions?.deployKnowledgeChat && (() => actions.deployKnowledgeChat!(selected.id)))}><Send size={14} /> {selected.status === "live" ? "Redeploy" : "Deploy"}</Button>}
          {!creating && selected?.status === "live" && <Link href={selected.url} target="_blank"><ExternalLink size={14} /> Open knowledge chat</Link>}
        </div>
      </Card>
    </div>
  );
}

function Body({ data, section, error, actions }: {
  data: PublishData; section: PublishSection; error: string | null; actions?: PublishActions;
}): ReactNode {
  if (error) return <ReadError>{error}</ReadError>;
  if (section === "bots") return <SourcesBots defaultOpen={null} slack={data.slack} github={data.github} actions={actions} />;
  if (section === "chat") return <KnowledgeChats chats={data.chats} selectedId={data.selectedChatId} actions={actions} />;
  return <PublishMcpServers servers={data.servers} actions={actions}
    createOpen={data.view === "mcp-add"}
    revealServer={data.view === "mcp-token" && data.created.token
      ? { name: data.created.name, token: data.created.token } : null} />;
}

function PublishPage({ data, loading = false, error = null, actions, chrome, mobile = false }: PageProps<PublishData, PublishActions>) {
  const section = SECTION[data.view];
  if (loading) return (
    <PageFrame chrome={chrome} active={navFor("publish")} title="Destinations" mobile={mobile}>
      <SkeletonPage variant="table" eyebrow="Delivery" title="Destinations"
        description="Deliver trusted product knowledge through interactive chat, MCP, and bots."
        icon={<span className="text-moss"><Send size={24} /></span>}
        tabs={TABS.map((tab) => tab.label)} columns={["Destination", "Status", "Actions"]} actions={0} mobile={mobile} />
    </PageFrame>
  );
  return (
    <PageFrame chrome={chrome} active={navFor("publish")} title="Destinations" mobile={mobile}>
      <div className="mx-auto max-w-[1400px] px-5 py-6 sm:px-8">
        <PageHeader eyebrow="Delivery" title="Destinations"
          description="Deliver trusted product knowledge through interactive chat, MCP, and bots."
          icon={<span className="text-moss"><Send size={24} /></span>} />
        <div className="mt-6 flex flex-col gap-5 [&>*]:min-w-0">
          {!error && <Tabs<PublishSection> ariaLabel="Destination sections" variant="underline"
            options={TABS} value={section} onChange={(next) => actions?.openSection?.(next)} />}
          <Body data={data} section={section} error={error} actions={actions} />
        </div>
      </div>
    </PageFrame>
  );
}

export const page: PageModule<PublishData, PublishActions> = {
  id: "publish", title: "Destinations", route: "/publish",
  component: PublishPage, states: STATES.map((state) => ({ ...state })),
};
