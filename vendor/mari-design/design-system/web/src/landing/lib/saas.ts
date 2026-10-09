// Console (saas) lives under /console.html on the same origin as the
// marketing site. saasUrl("/console") is the canonical entry-point link.
export const saasUrl = (path = "/console") => {
  const p = path.startsWith("/") ? path : `/${path}`;
  // Send marketing CTAs straight to the bootstrap so the saas auth flow
  // owns whatever sub-route the user lands on next.
  return p === "/console" ? "/console.html" : p;
};
