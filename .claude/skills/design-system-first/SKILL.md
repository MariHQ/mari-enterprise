---
name: design-system-first
description: Use the canonical Mari design skill for changes to app UI or presentation.
---

Read `vendor/mari-design/design-system/SKILL.md` and follow its surface-specific
rules. It is the canonical design guidance; do not maintain a separate copy here.

The original page components live in `vendor/mari-design/components`.
Each app owns its adapters and actions in `apps/<id>/web/src/`, with backend
handlers in `apps/<id>/`. The host lives in `container/web/`. Shared frontend
build tooling and hosting adapters live in `apps/base/web/`.

Map real API responses into the original page components. Preserve loading,
error, and empty states; do not invent data or mask failures with defaults.

From the Mari repository, run `make test-web` for type checks and
`node apps/base/web/build.mjs build apps/<id>` to build the changed app
(use `container` for the host).
