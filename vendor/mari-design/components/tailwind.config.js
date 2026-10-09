/** Tailwind theme for the preview server. Brand colors mirror
 *  BRAND-STYLE-GUIDE.md (light mode). Used only by `.preview`. */
export default {
  // Scan ALL source (excluding build/vendor dirs) rather than a hand-maintained
  // directory list — a stale list silently purges utility classes only used in
  // an unlisted dir, which makes those elements fall back to default sizing
  // (e.g. text-[26px] rendering at 16px). Robust so new dirs never break styles.
  content: [
    "./.preview/**/*.{ts,tsx,html}",
    "./**/*.{ts,tsx}",
    "!./node_modules/**",
    "!./dist/**",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#FFFFFF",
        ink: "#10263B",
        flysch: "#F0F2F5",
        biscay: { DEFAULT: "#1C3F60", 2: "#1E6FA8" },
        espelette: "#B23A1E",
        moss: "#2C6E49",
        clay: "#A05E1C",
      },
      fontFamily: {
        /* `term` and `display` are the names the components actually use:
           133 files reference `font-term` and 38 `font-display`. Neither was
           defined here, and nothing in the CSS covered for them, so every mono
           chrome label, table header, badge, count and page heading has been
           silently falling back to body sans — the utility simply did not
           exist, which fails invisibly rather than loudly.

           Per BRAND-STYLE-GUIDE.md §2: Inter for headings and body, JetBrains
           Mono for chrome and code, and no serif anywhere. `mono` stays as an
           alias so `font-mono` keeps working. */
        display: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        term: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
        "skeleton-fade": { "0%,100%": { opacity: "0.55" }, "50%": { opacity: "0.85" } },
      },
      animation: {
        shimmer: "shimmer 1.6s ease-in-out infinite",
        "skeleton-fade": "skeleton-fade 1.8s ease-in-out infinite",
      },
    },
  },
};
