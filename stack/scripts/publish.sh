#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .local/bundle
# Only declarative manifests enter the OCI artifact; credentials and state never do.
for dir in clusters/local clusters/substrate infrastructure apps; do
  mkdir -p ".local/bundle/$(dirname "$dir")"
  rsync -a --delete "$dir/" ".local/bundle/$dir/"
done
bin/flux push artifact oci://localhost:5001/stack/manifests:local --path=.local/bundle --source="local://orchid-stack" --revision="local@sha256:$(find .local/bundle -type f -exec shasum -a 256 {} + | shasum -a 256 | cut -d' ' -f1)" --insecure-registry
for context in docker-desktop kind-agent-substrate; do
  if kubectl --context "$context" -n flux-system get ocirepository stack >/dev/null 2>&1; then
    bin/flux reconcile source oci stack --context "$context"
  fi
done
