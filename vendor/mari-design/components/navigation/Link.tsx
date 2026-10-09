import { createContext, useContext, type AnchorHTMLAttributes, type ReactNode } from "react";
import { focusRing } from "../tokens/focusRing";

/* Link — the one way to navigate.
 *
 * It renders a REAL `<a href>`, always. That is not cosmetic: an anchor is
 * what gives you middle-click, cmd-click, "open in new tab", "copy link
 * address", a status-bar preview, and the right role for a screen reader. A
 * `<button onClick={navigate}>` has none of that, which is why the sidebar
 * (buttons) could not be opened in a new tab even once it worked.
 *
 * A plain left-click is intercepted and handed to `onNavigate` from context,
 * so the app routes without a full page reload. Every other click — modified,
 * middle, right — is left alone and the browser does its normal thing.
 *
 * With no NavProvider (the design canvas) the href still renders and the click
 * still works; there is simply no SPA router to hand it to. Components never
 * import a router, and never touch `window.location`.
 */

export type Navigate = (href: string) => void;

const NavContext = createContext<Navigate | null>(null);

/** The app supplies its router here, once, above the page. */
export function NavProvider({ navigate, children }: { navigate: Navigate; children: ReactNode }) {
  return <NavContext.Provider value={navigate}>{children}</NavContext.Provider>;
}

export function useNavigate(): Navigate | null {
  return useContext(NavContext);
}

/** True for a click the browser should keep: new tab, new window, download. */
function isModified(e: React.MouseEvent): boolean {
  return e.defaultPrevented || e.button !== 0 || e.metaKey || e.altKey || e.ctrlKey || e.shiftKey;
}

export type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  /** Force a full navigation (an external site, a file download). */
  external?: boolean;
};

export function Link({ href, external, className = "", onClick, children, ...rest }: LinkProps) {
  const navigate = useNavigate();
  const isExternal = external ?? /^(https?:|mailto:|tel:)/.test(href);

  return (
    <a
      href={href}
      className={`${focusRing} ${className}`.trim()}
      {...(isExternal ? { target: "_blank", rel: "noreferrer noopener" } : null)}
      onClick={(e) => {
        onClick?.(e);
        if (isExternal || !navigate || isModified(e)) return;
        e.preventDefault();
        navigate(href);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
