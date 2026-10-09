# Mari runtime infrastructure

Shared Kubernetes services remain owned by `~/stack`. This folder preserves
Mari-specific runtime image recipes and protocol definitions; it does not
provision a cluster or deploy anything.

`ax/Runner.Dockerfile` packages an existing `ax-task-runner` executable.
`ax/Claude.Dockerfile` extends an explicitly supplied `AX_RUNNER_IMAGE`, installs
the pinned Claude CLI, and packages `temporal/decision_miner.py`. Build the Claude
image from the parent workspace so its Mari and vendor paths resolve:

```sh
docker build -f mari/infra/ax/Claude.Dockerfile \
  --build-arg AX_RUNNER_IMAGE=<your-runner-image> -t mari-miner:local .
```

`ax/proto/` contains the AX protocol definitions used by the `temporal/Dockerfile`
worker image. Workflow and activity logic remains in `temporal/`.
