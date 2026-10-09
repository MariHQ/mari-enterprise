/* Settings → Models canvas fixtures. Lifted out of
   `pages/SettingsModelsPage.tsx` and `features/SettingsModelsConfig.tsx`. */

import type { SettingsModelsData } from "../../pages/SettingsModelsPage";
import type { ChunkRow, ProviderKeys } from "../../features/SettingsModelsConfig";
import type { PropertyItem } from "../../data-display/PropertyList";
import type { PageFixtures } from "./types";
import {
  LONG_PARAGRAPH, LONG_SOURCE, LONG_WORD, UNBREAKABLE, MIXED_SCRIPT, HUGE_NUMBER_STR, repeat,
} from "./stress";

const EMB_OPTIONS = ["openai:text-embedding-3-small", "openai:text-embedding-3-large", "local:bge-base-en"];
const LLM_OPTIONS = ["anthropic:claude-3-5-sonnet", "openai:gpt-4o", "openai:gpt-4o-mini", "ollama:llama3.1"];

const CHUNKING: ChunkRow[] = [
  { source: "GitHub", strategy: "heading", max_tokens: 800, overlap: 80 },
  { source: "Slack", strategy: "thread", max_tokens: 512, overlap: 0 },
  { source: "Google Drive", strategy: "fixed", max_tokens: 1024, overlap: 128 },
];

const KEYS: ProviderKeys = {
  openai: "sk-proj-9f2ac0d18b7e4a3c",
  anthropic: "sk-ant-api03-77de10bc2f",
};

const SUMMARY: PropertyItem[] = [
  { label: "Documents embedded", value: "12,201 of 12,480" },
  { label: "Vector dimensions", value: "1536" },
  { label: "Tokens per day", value: "1.4M" },
  { label: "Last re-index", value: "Jul 18, 2026" },
];

const BASE: SettingsModelsData = {
  phase: "config",
  embedding: EMB_OPTIONS[0],
  llm: LLM_OPTIONS[0],
  dims: 1536,
  embeddingOptions: EMB_OPTIONS,
  llmOptions: LLM_OPTIONS,
  chunking: CHUNKING,
  keys: KEYS,
  indexSummary: "12,480 documents · 12,201 embedded",
  testOk: "mari-api · 12,480 documents · 12,201 embedded",
  testError: "401: invalid API key for provider openai",
  summary: SUMMARY,
};

/** A workspace that has picked no models at all. */
const EMPTY: SettingsModelsData = { ...BASE, embedding: "", llm: "", chunking: [] };

function strained(extreme: boolean): SettingsModelsData {
  const opt = extreme ? UNBREAKABLE : LONG_SOURCE;
  const chunking: ChunkRow[] = repeat((i) => ({
    source: extreme ? [UNBREAKABLE, LONG_WORD, MIXED_SCRIPT][i % 3] : `${i + 1}. ${LONG_SOURCE}`,
    strategy: extreme ? UNBREAKABLE : "heading",
    max_tokens: 999999,
    overlap: 123456,
  }), 3);
  return {
    ...BASE,
    embedding: opt,
    llm: opt,
    embeddingOptions: [opt, ...EMB_OPTIONS],
    llmOptions: [opt, ...LLM_OPTIONS],
    chunking,
    keys: { openai: opt, anthropic: opt },
    indexSummary: extreme ? `${HUGE_NUMBER_STR} ${UNBREAKABLE}` : `${HUGE_NUMBER_STR} embedded`,
    testOk: extreme ? `${HUGE_NUMBER_STR} ${UNBREAKABLE}` : `${HUGE_NUMBER_STR} embedded`,
    testError: extreme ? MIXED_SCRIPT : LONG_PARAGRAPH,
    summary: [
      { label: "Endpoint", value: opt, stacked: true },
      { label: "Documents", value: extreme ? `${HUGE_NUMBER_STR} ${UNBREAKABLE}` : `${HUGE_NUMBER_STR} embedded` },
      { label: "Notes", value: extreme ? `${LONG_WORD} ${MIXED_SCRIPT}` : LONG_PARAGRAPH, stacked: true },
    ],
  };
}

export const FIXTURES: PageFixtures<SettingsModelsData> = {
  default: { data: BASE },
  loading: { data: BASE, loading: true },
  error: { data: BASE, error: "Model configuration is temporarily unavailable. Retrying…" },
  empty: { data: EMPTY },
  "editing-embedding": { data: { ...BASE, phase: "editing-embedding", embedding: EMB_OPTIONS[1] } },
  "editing-llm": { data: { ...BASE, phase: "editing-llm", llm: LLM_OPTIONS[1] } },
  "test-idle": { data: { ...BASE, phase: "test-idle" } },
  "test-testing": { data: { ...BASE, phase: "test-testing" } },
  "test-ok": { data: { ...BASE, phase: "test-ok" } },
  "test-fail": { data: { ...BASE, phase: "test-fail" } },
  saved: { data: { ...BASE, phase: "saved" } },
  overflow: { data: strained(false) },
  stress: { data: strained(true) },
};
