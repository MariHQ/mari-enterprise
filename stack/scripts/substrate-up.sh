#!/usr/bin/env bash
# Bootstrap only the cluster, Flux, and cluster-local credentials. Flux owns all workloads.
set -euo pipefail
cd "$(dirname "$0")/.."
context=kind-agent-substrate
ate="${KUBECTL_ATE:-kubectl-ate}"
if ! bin/kind get clusters | rg -qx agent-substrate; then
  bin/kind create cluster --name agent-substrate --config clusters/kind.yaml --image kindest/node:v1.36.1
  kubectl config use-context docker-desktop >/dev/null
fi
docker start kind-registry >/dev/null
if [ "$(docker inspect -f '{{json .NetworkSettings.Networks.kind}}' kind-registry)" = null ]; then
  docker network connect kind kind-registry
fi
docker exec agent-substrate-control-plane mkdir -p /etc/containerd/certs.d/localhost:5001
printf '[host."http://kind-registry:5000"]\n' | docker exec -i agent-substrate-control-plane cp /dev/stdin /etc/containerd/certs.d/localhost:5001/hosts.toml
docker exec agent-substrate-control-plane sysctl net.ipv4.conf.all.proxy_arp=1
kubectl --context "$context" apply --server-side -f clusters/flux-install.yaml
for namespace in ate-system podcertificate-controller-system; do
  kubectl --context "$context" create namespace "$namespace" --dry-run=client -o yaml | kubectl --context "$context" apply -f -
done
if ! kubectl --context "$context" -n ate-system get secret actor-id-jwt-pool >/dev/null 2>&1; then
  "$ate" --context "$context" admin make-jwt-pool --key-id=1 --name=actor-id-jwt-pool --secret-namespace=ate-system
fi
for pair in ate-system:actor-id-ca-pool podcertificate-controller-system:service-dns-ca-pool podcertificate-controller-system:pod-identity-ca-pool; do
  namespace=${pair%%:*}; name=${pair#*:}
  if ! kubectl --context "$context" -n "$namespace" get secret "$name" >/dev/null 2>&1; then
    "$ate" --context "$context" admin make-ca-pool --ca-id=1 --name="$name" --secret-namespace="$namespace"
  fi
done
cert=$(mktemp); trap 'rm -f "$cert"' EXIT
kubectl --context "$context" -n ate-system get secret actor-id-ca-pool -o jsonpath='{.data.pool}' | base64 --decode | jq -r '.. | objects | .RootCertificateDER? // empty' | base64 --decode | openssl x509 -inform DER -out "$cert"
kubectl --context "$context" -n ate-system create secret generic actor-id-ca-certs --from-file="ca.crt=$cert" --dry-run=client -o yaml | kubectl --context "$context" apply -f -
kubectl --context "$context" -n ate-system create secret generic ate-api-server-secret-envvars --from-literal='ATE_API_POSTGRES_CONNECTION_STRING=postgresql://postgres@postgres.ate-system.svc:5432/atepg?sslmode=verify-full&sslrootcert=/run/servicedns.podcert.ate.dev/trust-bundle.pem&sslcert=/run/podidentity.podcert.ate.dev/credential-bundle.pem&sslkey=/run/podidentity.podcert.ate.dev/credential-bundle.pem' --from-literal=ATE_API_POSTGRES_SCHEMA=public --dry-run=client -o yaml | kubectl --context "$context" apply -f -
kubectl --context docker-desktop -n stack get secret aws-credentials -o json | jq '{apiVersion,kind,type,data,metadata:{name:"aws-credentials",namespace:"ate-system"}}' | kubectl --context "$context" apply -f -
scripts/publish.sh
kubectl --context "$context" apply -f clusters/bootstrap-substrate.yaml
bin/flux reconcile source oci stack --context "$context"
bin/flux reconcile kustomization stack --context "$context"
