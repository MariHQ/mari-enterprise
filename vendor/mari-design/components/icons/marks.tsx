// Source / provider brand marks harvested from the console's connector catalog.
// Bespoke glyphs (GitHub, Slack, Google Drive, Notion, Granola, Google Docs)
// keep their brand colors; providers without a bespoke glyph fall back to a
// neutral plug drawn with `currentColor`. Upload → send glyph, doc sites → globe.

import { IconUpload, IconGlobe } from "./ui";

export interface MarkProps {
  /** Square edge length in px. Default 22. */
  size?: number;
  className?: string;
}

export function GithubMark({ size = 22, className }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden>
      <path
        fill="#24292f"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  );
}

export function SlackMark({ size = 22, className }: MarkProps) {
  // Official four-hook mark. The previous version leaned on rotate()
  // transforms that mis-registered the hooks and read as confetti.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#E01E5A"
        d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"
      />
      <path
        fill="#36C5F0"
        d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"
      />
      <path
        fill="#2EB67D"
        d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z"
      />
      <path
        fill="#ECB22E"
        d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"
      />
    </svg>
  );
}

export function DriveMark({ size = 22, className }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 87.3 78" className={className} aria-hidden>
      <path fill="#0066da" d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" />
      <path fill="#00ac47" d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z" />
      <path fill="#ea4335" d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" />
      <path fill="#00832d" d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" />
      <path fill="#2684fc" d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" />
      <path fill="#ffba00" d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" />
    </svg>
  );
}

export function NotionMark({ size = 22, className }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="3.5" fill="#fff" stroke="#2d2a22" strokeWidth="1.5" />
      <path d="M7.5 17.5 V 6.8 l1.8 -.2 5.6 8.6 V 6.5 H 17 v 10.8 l-2 .2 -5.7 -8.7 v 8.5 z" fill="#2d2a22" />
    </svg>
  );
}

export function GranolaMark({ size = 22, className }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="#2d2a22" />
      <path
        d="M16.6 8.6 a5.4 5.4 0 1 0 .9 4.6 h-5"
        fill="none" stroke="#f6f0e3" strokeWidth="2.1" strokeLinecap="round"
      />
    </svg>
  );
}

export function DocsMark({ size = 22, className }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="4" y="2.5" width="16" height="19" rx="2.5" fill="#3086f6" />
      <path d="M8 8.5h8M8 12h8M8 15.5h5.5" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function ConfluenceMark({ size = 22, className }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden fill="none">
      <path d="M2 17.4C6 11.6 15 12.6 22 18.2" stroke="#2684FF" strokeWidth="4" strokeLinecap="round" />
      <path d="M22 6.6C18 12.4 9 11.4 2 5.8" stroke="#0052CC" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function JiraMark({ size = 22, className }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#2684FF"
        d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.35 4.34 4.35V2.84a.84.84 0 0 0-.84-.84zM6.77 6.8a4.362 4.362 0 0 0 4.34 4.34h1.8v1.72a4.362 4.362 0 0 0 4.34 4.34V7.63a.84.84 0 0 0-.83-.83zM2 11.6a4.362 4.362 0 0 0 4.34 4.34h1.8v1.72A4.362 4.362 0 0 0 12.48 22v-9.57a.84.84 0 0 0-.84-.83z"
      />
    </svg>
  );
}

export function LinearMark({ size = 22, className }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" fill="#5E6AD2" />
      <path
        d="M6.2 13.9 10.1 17.8M6 9.6 14.4 18M7.7 6.2 17.8 16.3"
        stroke="#fff" strokeWidth="1.7" strokeLinecap="round" fill="none"
      />
    </svg>
  );
}

export function FigmaMark({ size = 22, className }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#0ACF83" d="M8 24a4 4 0 0 0 4-4v-4H8a4 4 0 0 0 0 8z" />
      <path fill="#A259FF" d="M4 12a4 4 0 0 1 4-4h4v8H8a4 4 0 0 1-4-4z" />
      <path fill="#F24E1E" d="M4 4a4 4 0 0 1 4-4h4v8H8a4 4 0 0 1-4-4z" />
      <path fill="#FF7262" d="M12 0h4a4 4 0 0 1 0 8h-4V0z" />
      <path fill="#1ABCFE" d="M20 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" />
    </svg>
  );
}

export function ZendeskMark({ size = 22, className }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <g fill="#03363D">
        <path d="M11.1 7.2V21H0z" />
        <path d="M11.1 3a5.55 5.55 0 0 1-11.1 0z" />
        <path d="M12.9 21a5.55 5.55 0 0 1 11.1 0z" />
        <path d="M12.9 16.8V3H24z" />
      </g>
    </svg>
  );
}

export function S3Mark({ size = 22, className }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#569A31"
        d="M4.4 4.8h15.2l-1.4 14.5a1.6 1.6 0 0 1-1.1 1.4 17.4 17.4 0 0 1-10.2 0 1.6 1.6 0 0 1-1.1-1.4z"
      />
      <ellipse cx="12" cy="4.6" rx="6.6" ry="1.9" fill="#7AB55C" />
    </svg>
  );
}

export function WebhookMark({ size = 22, className }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden fill="none">
      <path d="M8.4 9.4 5.6 14.3M11 8.3l4.6 2.6M11.6 18.6h5.2" stroke="#4B4B4B" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="8.6" cy="6.6" r="2.9" fill="#C73A63" />
      <circle cx="18" cy="12.4" r="2.9" fill="#4B4B4B" />
      <circle cx="8.8" cy="18.6" r="2.9" fill="#C73A63" />
    </svg>
  );
}

export function AsanaMark({ size = 22, className }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden fill="#F06A6A">
      <circle cx="12" cy="6.1" r="3.7" />
      <circle cx="5.6" cy="16.6" r="3.7" />
      <circle cx="18.4" cy="16.6" r="3.7" />
    </svg>
  );
}

export function TrelloMark({ size = 22, className }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="3.6" fill="#0079BF" />
      <rect x="5.2" y="5.2" width="6.2" height="13.6" rx="1.2" fill="#fff" />
      <rect x="12.8" y="5.2" width="6" height="8.4" rx="1.2" fill="#fff" />
    </svg>
  );
}

export function AirtableMark({ size = 22, className }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#FCB400" d="M11.3 2.6 2.4 6.3c-.5.2-.5.9 0 1.1l9 3.5c.4.2.9.2 1.3 0l9-3.5c.5-.2.5-.9 0-1.1l-9-3.7a1.8 1.8 0 0 0-1.4 0z" />
      <path fill="#18BFFF" d="M12.9 13.1v8.3c0 .4.4.7.8.5l8.9-3.4c.2-.1.4-.4.4-.6V9.5c0-.4-.4-.7-.8-.5l-8.9 3.5c-.2.1-.4.3-.4.6z" />
      <path fill="#F82B60" d="M11 13.4 2.4 9.2c-.4-.2-.9.1-.9.6v7.7c0 .3.2.6.5.7l8.6 3.5c.4.2.9-.1.9-.6v-7.1c0-.3-.2-.5-.5-.6z" />
    </svg>
  );
}

export function DropboxMark({ size = 22, className }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden fill="#0061FF">
      <path d="M6 1.8 0 5.7l6 3.9 6-3.9zM18 1.8l-6 3.9 6 3.9 6-3.9zM0 13.5l6 3.9 6-3.9-6-3.9zM18 9.6l-6 3.9 6 3.9 6-3.9zM6 18.7l6 3.9 6-3.9-6-3.9z" />
    </svg>
  );
}

/** Neutral plug mark (currentColor) for providers without a bespoke glyph. */
export function PlugMark({ size = 22, className }: MarkProps) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true"
    >
      <path d="M9 7V3M15 7V3" />
      <path d="M6.5 7h11v4a5.5 5.5 0 0 1-11 0V7Z" />
      <path d="M12 16.5V19a2.5 2.5 0 0 1-2.5 2.5" />
    </svg>
  );
}

/** Every provider the console's connector catalog defines. */
export const PROVIDERS = [
  "github", "slack", "gdocs", "gdrive", "notion", "granola", "docs",
  "confluence", "jira", "linear", "figma", "zendesk",
  "asana", "trello", "airtable", "dropbox", "s3", "webhook",
  "upload", "docsite",
] as const;

export type Provider = (typeof PROVIDERS)[number];

/** Human-readable provider names (mirrors the source PROVIDER_NAME map). */
export const PROVIDER_NAME: Record<string, string> = {
  github: "GitHub", slack: "Slack", gdocs: "Google Drive", gdrive: "Google Drive",
  docs: "Google Docs", notion: "Notion", granola: "Granola",
  confluence: "Confluence", jira: "Jira", linear: "Linear", figma: "Figma",
  zendesk: "Zendesk", asana: "Asana", trello: "Trello",
  airtable: "Airtable", dropbox: "Dropbox", s3: "Amazon S3", webhook: "Webhook",
  upload: "Upload", docsite: "Doc site",
};

/** Aliases callers use interchangeably for the same provider. */
const ALIAS: Record<string, string> = {
  gdrive: "gdocs",
  drive: "gdocs",
  "google-drive": "gdocs",
  gdoc: "docs",
  "google-docs": "docs",
  atlassian: "confluence",
  aws: "s3",
};

/**
 * Keyed provider mark: a real brand glyph for every provider the console
 * references, and a neutral plug only for genuinely unknown keys.
 * `upload`/`docsite` reuse UI icons rather than a brand mark.
 */
export function SourceMark({ provider, size = 22, className }: MarkProps & { provider: string }) {
  const key = ALIAS[provider] ?? provider;
  switch (key) {
    case "github": return <GithubMark size={size} className={className} />;
    case "slack": return <SlackMark size={size} className={className} />;
    case "gdocs": return <DriveMark size={size} className={className} />;
    case "notion": return <NotionMark size={size} className={className} />;
    case "granola": return <GranolaMark size={size} className={className} />;
    case "docs": return <DocsMark size={size} className={className} />;
    case "confluence": return <ConfluenceMark size={size} className={className} />;
    case "jira": return <JiraMark size={size} className={className} />;
    case "linear": return <LinearMark size={size} className={className} />;
    case "figma": return <FigmaMark size={size} className={className} />;
    case "zendesk": return <ZendeskMark size={size} className={className} />;
    case "asana": return <AsanaMark size={size} className={className} />;
    case "trello": return <TrelloMark size={size} className={className} />;
    case "airtable": return <AirtableMark size={size} className={className} />;
    case "dropbox": return <DropboxMark size={size} className={className} />;
    case "s3": return <S3Mark size={size} className={className} />;
    case "webhook": return <WebhookMark size={size} className={className} />;
    case "upload": return <IconUpload size={size} className={className} />;
    case "docsite": return <IconGlobe size={size} className={className} />;
    default: return <PlugMark size={size} className={className} />;
  }
}
