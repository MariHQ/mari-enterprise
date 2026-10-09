import type { PublishData } from "../../pages/PublishPage";
import type { McpServer } from "../../features/PublishMcpServers";
import type { PageFixtures } from "./types";
import { LONG_TITLE, LONG_URL, UNBREAKABLE, repeat } from "./stress";

const SERVERS: McpServer[] = [
  { id: 1, name: "support-kb", url: "https://mcp.acme.test/mcp/support-kb", scope: "product", status: "connected", capabilities: ["search", "facts", "answers"] },
  { id: 2, name: "eng-lineage", url: "https://mcp.acme.test/mcp/eng-lineage", scope: "org", status: "idle", capabilities: ["search", "lineage"] },
];

const BASE: PublishData = {
  view: "chat",
  servers: SERVERS,
  serverCount: SERVERS.length,
  draft: { name: "", scope: "workspace", capabilities: [], toolCount: 0 },
  created: { name: "", scopeLabel: "", toolCount: 0, token: "", snippet: "" },
  chats: [{ id: 1, name: "Company knowledge", slug: "company-knowledge", title: "Ask Acme",
    welcome: "Ask about company policy.", status: "live", url: "/knowledge-chat/acme/company-knowledge", tools: ["search", "facts", "answers"] }],
  selectedChatId: null,
  slack: { configured: true, teamName: "Acme HQ", lastEventAt: "2026-07-21T13:58:00" },
  github: { webhookConfigured: true, repos: ["acme/handbook", "acme/api"] },
};

const STRESS: PublishData = {
  ...BASE,
  view: "mcp-list",
  servers: repeat((index) => ({
    id: index + 1, name: index % 5 === 0 ? UNBREAKABLE : `${index + 1}-${LONG_TITLE}`,
    url: LONG_URL, scope: "workspace" as const, status: index % 2 ? "idle" as const : "connected" as const,
    capabilities: ["search", "facts", "answers", "lineage"],
  }), 80),
  serverCount: 80,
};

export const FIXTURES: PageFixtures<PublishData> = {
  default: { data: BASE },
  mcp: { data: { ...BASE, view: "mcp-list" } },
  "mcp-add": { data: { ...BASE, view: "mcp-add" } },
  "mcp-token": { data: { ...BASE, view: "mcp-token", created: {
    name: "support-kb", scopeLabel: "Product", toolCount: 3,
    token: "mari_mcp_example_once", snippet: "Authorization: Bearer mari_mcp_example_once",
  } } },
  "mcp-empty": { data: { ...BASE, view: "mcp-list", servers: [], serverCount: 0 } },
  bots: { data: { ...BASE, view: "bots" } },
  loading: { data: BASE, loading: true },
  error: { data: BASE, error: "Destinations are temporarily unavailable." },
  empty: { data: { ...BASE, chats: [], servers: [], serverCount: 0 } },
  overflow: { data: { ...STRESS, servers: STRESS.servers.slice(0, 3) } },
  stress: { data: STRESS },
};
