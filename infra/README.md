# Mari runtime infrastructure

Shared Kubernetes services are included in `stack/`. This folder preserves
Mari-specific runtime image recipes and protocol definitions; it does not
provision a cluster or deploy anything.

`ax/Runner.Dockerfile` packages an existing `ax-task-runner` executable.
`ax/Claude.Dockerfile` extends an explicitly supplied `AX_RUNNER_IMAGE`, installs
the pinned Claude CLI, and packages `temporal/decision_miner.py`. Build the Claude
image from the repository root so its vendor paths resolve:

```sh
docker build -f infra/ax/Claude.Dockerfile \
  --build-arg AX_RUNNER_IMAGE=<your-runner-image> -t mari-miner:local .
```

`ax/proto/` contains the AX protocol definitions used by the `temporal/Dockerfile`
worker image. Workflow and activity logic remains in `temporal/`.

## Local Flux release

After building the app base/apps, `flink/`, and `temporal/` images, run
`python infra/release-local.py` from Mari to publish them to the existing local
registry and render a reviewable release. `--apply` also activates the release's
Flux source and dependency stages. It never compiles OrchidDB or pushes to GitHub.
The release pins image digests and includes only rendered manifests; credentials,
source trees, and local state are not bundled. Run `python infra/configure-local.py` first to install runtime Secrets from the
ignored local environment, preserving existing session keys. It does not log
credentials. Source polling uses the configured GitHub/Slack credentials; paid
mining remains disabled until explicitly enabled. Maintenance is restricted to
the typed topic tables declared in `flink/ingestion.yaml`.
Use `--enable-mining --miner-image <registry/image@sha256:digest>` with the
existing Claude subscription token to enable decision extraction, and
`--enable-ax-observation` to collect the miner's existing traces. Restart the
Temporal worker after changing its Secret, then run `temporal.bootstrap` with
`TEMPORAL_JOBS_ENABLED=true` to register the enabled flows.
The last stage starts the Temporal worker and its explicitly configured jobs.

`configure-local.py --storage iceberg|postgres` selects the sink and native
OrchidDB engine together; applications keep the same Cypher. PostgreSQL is the
local default. Use the fixed OrchidDB wheel from
`artifacts/python-linux-arm64-20261009-120347-396270/` or a newer validated release.
PostgreSQL does not require copying the existing lake: Kafka can replay into the
typed tables. Keep S3 while Iceberg remains active.

Flink checkpoints, savepoints, and HA metadata default to the shared
`mari-flink-state` PVC at `file:///var/lib/mari-flink`. Use `release-local.py
--apply --reset-state` for the initial backend change, then ordinary savepoint
upgrades. `--state-uri s3://bucket/prefix` selects remote state again; credentials
remain supplied by the existing Secret. The local PVC is intended for this
single-node cluster, not a multi-node production deployment.
