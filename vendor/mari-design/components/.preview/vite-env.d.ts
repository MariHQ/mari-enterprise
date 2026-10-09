/// <reference types="vite/client" />

/* Ambient Vite types for the canvas. Without this, `import.meta.glob` (used by
   the fixture registry) is an error and `import.meta.env` is untyped — the
   repo had no ambient declaration at all, which went unnoticed only because
   `.preview` was excluded from tsconfig's include globs. */
