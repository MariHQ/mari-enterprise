# Vendored Mari libraries

These source snapshots are committed directly so a checkout includes the UI and
worker dependencies used by Mari Enterprise. Each retains its upstream license.

| Directory | Source | Base revision |
| --- | --- | --- |
| `mari-design` | https://github.com/MariHQ/mari-design | `df8378469b9312f36bdf3003f1a82a9a4a018b80` |
| `mari-kit` | https://github.com/MariHQ/mari-kit | `b030b0d49975cba39b05725c816f4e01429d9bf1` |
| `mari-kit-runtime` | https://github.com/MariHQ/mari-kit | `e92721a3a23e595c27ce5b14cbbfb2763f0b5069` |

Snapshots include workspace changes present on October 9, 2026. `mari-kit` holds
the component packages; `mari-kit-runtime` holds the newer runtime source used by
the Temporal and miner images. They serve different import contracts today.
