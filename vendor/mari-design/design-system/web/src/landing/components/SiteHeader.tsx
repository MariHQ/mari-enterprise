import { Link } from "react-router-dom";
import { Github } from "lucide-react";
import { Logo } from "@/components/Logo";
import { saasUrl } from "@landing/lib/saas";

const CALENDLY_URL = "https://calendly.com/henneberger-daniel/30min";
const COMMUNITY = {
  discord: "https://discord.gg/RdZyvwevp",
  slack: "https://join.slack.com/t/mari-v9h7907/shared_invite/zt-3xjdp77m9-Oh2~ZJO1toLUzHFgLeQgEA",
  github: "https://github.com/MariHQ",
};

const DiscordIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
    <path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3a14.27 14.27 0 0 0-.69 1.404 18.27 18.27 0 0 0-5.487 0A12.7 12.7 0 0 0 9.69 3 19.79 19.79 0 0 0 5.93 4.369C2.52 9.394 1.59 14.302 2.05 19.13a19.94 19.94 0 0 0 6.045 3.04 14.6 14.6 0 0 0 1.292-2.092 12.83 12.83 0 0 1-2.034-.972c.17-.124.337-.252.498-.383a14.16 14.16 0 0 0 12.298 0c.162.131.328.26.498.383a12.86 12.86 0 0 1-2.038.974 14.6 14.6 0 0 0 1.292 2.09 19.94 19.94 0 0 0 6.045-3.04c.54-5.6-.913-10.46-3.629-14.761ZM9.34 16.27c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.951-2.418 2.157-2.418 1.205 0 2.18 1.085 2.157 2.418.002 1.334-.952 2.42-2.157 2.42Zm5.32 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.951-2.418 2.157-2.418 1.205 0 2.18 1.085 2.157 2.418 0 1.334-.952 2.42-2.157 2.42Z"/>
  </svg>
);

const SlackIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52ZM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313ZM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834ZM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312ZM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834ZM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312ZM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52ZM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313Z"/>
  </svg>
);

export const SiteHeader = ({ maxWidth = "max-w-6xl" }: { maxWidth?: string }) => {
  return (
    <header className="sticky top-0 z-50">
      <div className={`mx-auto ${maxWidth} px-6 mt-4`}>
        <nav className="glass border border-border/80 rounded-2xl flex items-center justify-between px-4 py-2.5">
          <Link to="/" className="hover:opacity-80 transition-opacity">
            <Logo />
          </Link>
          <div className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link to="/blog" className="hover:text-foreground transition-colors">Blog</Link>
          </div>
          <div className="flex items-center gap-2">
            <a href={COMMUNITY.discord} target="_blank" rel="noopener noreferrer" aria-label="Discord"
               className="hidden sm:inline-flex text-muted-foreground hover:text-foreground p-1.5 rounded-lg transition-colors">
              <DiscordIcon />
            </a>
            <a href={COMMUNITY.slack} target="_blank" rel="noopener noreferrer" aria-label="Slack"
               className="hidden sm:inline-flex text-muted-foreground hover:text-foreground p-1.5 rounded-lg transition-colors">
              <SlackIcon />
            </a>
            <a href={COMMUNITY.github} target="_blank" rel="noopener noreferrer" aria-label="GitHub"
               className="hidden sm:inline-flex text-muted-foreground hover:text-foreground p-1.5 rounded-lg transition-colors">
              <Github className="h-4 w-4" />
            </a>
            <span className="hidden sm:inline-block w-px h-5 bg-border mx-1" aria-hidden="true" />
            <a href={saasUrl("/login")} className="hidden sm:inline-flex text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg transition-colors">
              Sign In
            </a>
            <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="text-sm font-medium bg-foreground text-background hover:bg-foreground/90 px-3.5 py-1.5 rounded-lg transition-colors">
              Book Demo
            </a>
          </div>
        </nav>
      </div>
    </header>
  );
};
