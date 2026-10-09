#!/usr/bin/env bash
# Build local images only. Never push, deploy, or change Kubernetes resources.
set -euo pipefail
BASE_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
MARI_DIR=$(cd "$BASE_DIR/../.." && pwd)
WHEEL=""
PLATFORM=""
BASE_TAG=mari-app-base:local
APPS=all
OUTPUT_DIR="$MARI_DIR/.artifacts/app-base"
usage() {
  cat <<'EOF'
Usage: apps/base/build.sh --orchiddb-wheel FILE [options]

  --orchiddb-wheel FILE  Copy a prebuilt catalog-capable Linux wheel; no compilation.
  --platform PLATFORM   linux/arm64 or linux/amd64 (default: Docker engine architecture).
  --tag IMAGE           Shared runtime image tag (default: mari-app-base:local).
  --apps LIST           Comma-separated screen folders and/or container (default: all apps in container/apps.json).
  --base-only           Build the shared base without application images.
  --output DIR          Release and build metadata output (default: mari/.artifacts/app-base).
  --help                Print help. No build or Docker connection is made.

Nothing is pushed or deployed. No source checkout is modified.
EOF
}
while (($#)); do
  case "$1" in
    --orchiddb-wheel) WHEEL=${2:?Missing wheel path}; shift 2 ;;
    --platform) PLATFORM=${2:?Missing platform}; shift 2 ;;
    --tag) BASE_TAG=${2:?Missing tag}; shift 2 ;;
    --apps) APPS=${2:?Missing app list}; shift 2 ;;
    --base-only) APPS=""; shift ;;
    --output) OUTPUT_DIR=${2:?Missing output directory}; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) printf 'Unknown option: %s\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
done
if [[ -z "$WHEEL" ]]; then
  echo 'Supply --orchiddb-wheel FILE. Build OrchidDB separately with ~/orchiddb/scripts/build-linux-release.sh' >&2
  exit 2
fi
command -v docker >/dev/null
command -v python3 >/dev/null
if [[ -z "$PLATFORM" ]]; then
  architecture=$(docker info --format '{{.Architecture}}')
  case "$architecture" in aarch64|arm64) PLATFORM=linux/arm64;; x86_64|amd64) PLATFORM=linux/amd64;; *) echo "Unsupported Docker architecture: $architecture" >&2; exit 2;; esac
fi
[[ "$PLATFORM" == linux/arm64 || "$PLATFORM" == linux/amd64 ]] || { echo 'Use linux/arm64 or linux/amd64 for Docker/Kubernetes images' >&2; exit 2; }
if [[ "$APPS" == all ]]; then
  APPS=$(python3 -c 'import json,sys; print(",".join(a["id"] for a in json.load(open(sys.argv[1]))["apps"])+",container")' "$MARI_DIR/container/apps.json")
fi
# Validate app names before spending time building dependencies.
app_names=("")
if [[ -n "$APPS" ]]; then IFS=',' read -r -a app_names <<< "$APPS"; fi
for name in "${app_names[@]}"; do
  [[ -z "$name" ]] && continue
  [[ "$name" =~ ^[a-z][a-z0-9-]*$ ]] || { echo "Invalid app: $name" >&2; exit 2; }
  relative="apps/$name"; [[ "$name" == container ]] && relative=container
  [[ -f "$MARI_DIR/$relative/web/src/main.tsx" ]] || { echo "Missing app entrypoint: $relative/web/src/main.tsx" >&2; exit 2; }
done
mkdir -p "$OUTPUT_DIR"
OUTPUT_DIR=$(cd "$OUTPUT_DIR" && pwd)
STAGING=$(mktemp -d "${TMPDIR:-/tmp}/mari-base.XXXXXXXX")
trap 'rm -rf "$STAGING"' EXIT
mkdir -p "$STAGING/wheels"
python3 "$BASE_DIR/scripts/validate_wheel.py" "$WHEEL" "$PLATFORM"
cp "$WHEEL" "$STAGING/wheels/"
docker buildx build --load --platform "$PLATFORM" --build-context "orchiddb-wheel=$STAGING/wheels" \
  -f "$BASE_DIR/Dockerfile" -t "$BASE_TAG" "$MARI_DIR"
docker image inspect "$BASE_TAG" --format '{{.Id}}' > "$OUTPUT_DIR/base-image-id.txt"
for name in "${app_names[@]}"; do
  [[ -z "$name" ]] && continue
  relative="apps/$name"; [[ "$name" == container ]] && relative=container
  entrypoint=application.server:app
  [[ "$name" == container ]] && entrypoint=application.server:app
  docker buildx build --load --platform "$PLATFORM" --build-arg "APP_ID=$name" --build-arg "MARI_ENTRYPOINT=$entrypoint" --build-arg "MARI_APP_BASE=$BASE_TAG" \
    --build-arg "APP_DIR=$relative" -f "$BASE_DIR/App.Dockerfile" -t "mari-$name:local" "$MARI_DIR"
done
printf '\nBuilt %s for %s. Image ID: %s/base-image-id.txt\n' "$BASE_TAG" "$PLATFORM" "$OUTPUT_DIR"
printf 'Local images only; nothing was pushed or deployed.\n'
