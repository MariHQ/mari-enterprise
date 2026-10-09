#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Shared services run directly on the existing local Kubernetes cluster.
# This command never creates a kind cluster or deploys Agent Substrate.
kubectl --context docker-desktop get node docker-desktop >/dev/null
mkdir -p logs
if ! docker inspect kind-registry >/dev/null 2>&1; then
  docker run -d --restart=always -p 127.0.0.1:5001:5000 --name kind-registry registry:3
fi
docker start kind-registry >/dev/null
bin/terraform -chdir=terraform init -input=false
bin/terraform -chdir=terraform plan -out=stack.tfplan
bin/terraform -chdir=terraform show -json stack.tfplan | python3 -c 'import json,sys; p=json.load(sys.stdin); assert all(r["type"].startswith("aws_s3_") and "delete" not in r["change"]["actions"] for r in p.get("resource_changes",[]) if r["mode"]=="managed"), "Refusing a non-S3 or destructive plan"'
bin/terraform -chdir=terraform apply -input=false stack.tfplan
python3 scripts/credentials.py
kubectl --context docker-desktop apply --server-side -f clusters/flux-install.yaml
scripts/publish.sh
kubectl --context docker-desktop apply -f clusters/bootstrap.yaml
printf 'Flux is reconciling on docker-desktop. Run make status.\n'
