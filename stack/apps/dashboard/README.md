# Service dashboard

Open http://localhost:8085 for Mari, Temporal, and Flink.
Temporal is at http://localhost:18000 and Flink at http://localhost:18001.
These Docker Desktop LoadBalancer services need no port-forward processes.

The page is static HTML built from the canonical Mari design components in
`~/mari-root/mari-design/components`. It has no browser JavaScript or telemetry.
Fonts are embedded from the design library; their licenses are in the same
design-system font directory.

To rebuild and deploy from `~/stack`:

```sh
node apps/dashboard/build.mjs
./scripts/publish.sh
./bin/flux reconcile kustomization stack --context docker-desktop
./bin/flux reconcile kustomization dashboard --context docker-desktop
```
