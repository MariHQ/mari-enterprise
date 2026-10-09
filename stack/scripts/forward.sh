#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p logs
pids=()
cleanup() { for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done; }
trap cleanup EXIT INT TERM
for binding in 'polaris 8181:8181' 'orchid-catalog 8182:8182' 'temporal 7233:7233' 'temporal-ui 8080:8080' 'mari-ingestion-rest 8081:8081' 'postgres 5433:5432'; do
  read -r service ports <<< "$binding"
  kubectl --context docker-desktop -n stack port-forward "svc/$service" "$ports" --address=127.0.0.1 > "logs/forward-$service.log" 2>&1 &
  pids+=("$!")
done
kubectl --context docker-desktop -n kourier-system port-forward svc/kourier 8084:80 --address=127.0.0.1 > logs/forward-kourier.log 2>&1 &
pids+=("$!")
wait
