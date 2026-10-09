/* The address a published doc site actually lives at.

   Sites are stored as a bare domain ("docs.acme.com"). Several places offered
   to open one and linked to "#" instead, which focuses and clicks like a link
   and goes nowhere. One helper so the scheme is decided once: a bare domain is
   https, and anything already carrying a scheme is passed through, since a
   local or staging site may legitimately be http or carry a port. */
export function siteUrl(domain: string): string {
  const d = domain.trim();
  if (!d) return "";
  return /^https?:\/\//i.test(d) ? d : `https://${d}`;
}

/* The address of a site's latest BUILD, before or regardless of deploy.

   The server mounts every build at /sites/site_{id}/ (app.py's StaticFiles
   mount), and the console's dev proxy forwards /sites to it, so a relative
   URL works from the console origin in every environment. This is the "see it
   before you publish it" link: a draft site has a perfectly good build here
   even though its own domain serves nothing yet. */
export function sitePreviewUrl(id: number): string {
  return `/sites/site_${id}/`;
}
