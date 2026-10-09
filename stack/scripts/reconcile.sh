#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
for component in infrastructure knative-crds knative-serving knative-kourier postgres kafka catalogs temporal bootstrap schema-registry; do
  bin/flux reconcile kustomization "$component" --context docker-desktop --timeout=60s
done
