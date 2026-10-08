# Flux deployment runbook

Mari deploys through the Flux platform in `platform/`. Follow the
[platform setup and prerequisites](../platform/README.md#build-and-flux) for
configuration, tooling, and release commands. Those commands run from the parent
workspace containing `mari/` and the platform Makefile.

## Release and reconciliation

The platform deployment validates the pinned OrchidDB wheel, builds images,
pins their digests, and uploads an immutable S3 manifest release beneath
`flux/releases/<content-hash>/`. Flux reconciles operators, infrastructure,
Kafka, Substrate, and applications in dependency order. Deployment creates
Kubernetes secrets separately from the manifest artifact.

Configure the platform in `platform/config/platform.json`. Keep credentials in
the ignored `platform/.env` file with mode 0600; never include credentials in
configuration JSON or release manifests. Preserve existing PVCs and stream
offsets during rollout and recovery.

## Verify a rollout

From the parent workspace, inspect reconciliation and workloads:

```sh
kubectl --kubeconfig .platform-state/kubeconfig -n flux-system get kustomizations
kubectl --kubeconfig .platform-state/kubeconfig -n mari-platform get pods
make check
```

See [Operating Flux](../platform/README.md#operating-flux) for reconciliation
intervals and operational limits, and the platform validation section for live
checks of the Kafka/Flink/Iceberg path.

## Application boundary

The Mari image is built with `deploy/Dockerfile.governance` and published by
`platform/scripts/deploy.py`. It contains no PostgreSQL driver or embedded lake
query engine. Reads go to the authenticated Knowledge API; writes go to Kafka.
The Mari Deployment must not receive `iceberg-catalog`, database, or S3 credentials.

Temporal and the Knowledge API's catalog integration retain their infrastructure
PostgreSQL connections. Back up and restore those services using their own
operational procedures, not the retired Mari database restore scripts.
