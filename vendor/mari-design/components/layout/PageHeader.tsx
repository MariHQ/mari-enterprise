import type { ReactNode } from "react";
import { Link } from "../navigation/Link";
import { ArrowLeft } from "lucide-react";
import { focusRing } from "../tokens/focusRing";

export type PageHeaderProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  /* Where "back" goes. `href` keeps it a real link — openable in a new tab,
     with a destination in the status bar. `onClick` is for the case where back
     is a change of view rather than of URL; it is handled IN ADDITION to the
     href, so the control still works if the host has no router. A backLink
     with neither used to render as href="#", which looks like a link, focuses
     like a link, and does nothing. */
  backLink?: { href: string; label: string; onClick?: () => void };
};

/* Header-only fragment, for screens that need more control over body layout
   than Page gives — Page owns the full-screen padding + header + children,
   PageHeader is just the header block on its own. Same typography as Page
   so the two are interchangeable at the header level. */
export function PageHeader({ title, eyebrow, description, icon, actions, backLink }: PageHeaderProps) {
  return (
    // flex-wrap + a min-width on the title block: a `shrink-0` actions slot used
    // to eat the entire row at phone widths, truncating titles to "D." and
    // wrapping the description one word per line. Actions now drop to their own
    // line instead of crushing the title.
    <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-3">
      <div className="flex min-w-[15rem] flex-1 items-start gap-3">
        {icon && <span className="shrink-0 mt-0.5" aria-hidden="true">{icon}</span>}
        <div className="min-w-0">
          {backLink && (
            <Link
              href={backLink.href}
              onClick={backLink.onClick && ((e) => { e.preventDefault(); backLink.onClick!(); })}
              className="inline-flex items-center gap-1 mb-1.5 text-[12.5px] font-medium text-ink/65 hover:text-ink rounded-[3px]"
            >
              <ArrowLeft size={13} />
              {backLink.label}
            </Link>
          )}
          {eyebrow && (
            <div className="flex items-center gap-2 mb-1.5 font-term text-[10.5px] font-medium uppercase tracking-[0.18em] text-biscay-2">
              <span className="inline-block w-[7px] h-[7px] bg-biscay-2" aria-hidden />
              {eyebrow}
            </div>
          )}
          {/* The page title is the page's <h1> (ACC-01). Every framed page used
              to open at h3 with the card titles as its siblings, so the console
              had no level-1 or level-2 heading anywhere and no outline to
              navigate by. The size is unchanged — this is semantics only. */}
          <h1 className="text-[22px] font-bold leading-tight tracking-[-0.015em] text-ink [overflow-wrap:anywhere]">{title}</h1>
          {description && <p className="mt-1 max-w-[680px] text-[13px] text-ink/70 [overflow-wrap:anywhere]">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
