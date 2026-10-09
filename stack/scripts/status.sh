#!/usr/bin/env bash
set -euo pipefail
kubectl --context docker-desktop -n flux-system get kustomizations,helmreleases
kubectl --context docker-desktop -n stack get pods,flinkdeployment,kafka
kubectl --context docker-desktop -n knative-serving get pods
kubectl --context docker-desktop -n kourier-system get pods,services
kubectl --context docker-desktop get services.serving.knative.dev -A
kubectl --context kind-agent-substrate -n flux-system get kustomizations
kubectl --context kind-agent-substrate -n ate-system get pods,workerpools
kubectl --context kind-agent-substrate -n ax-system get pods
