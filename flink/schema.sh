#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ "$(uname -s)" == Darwin ]]; then
  export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
fi
if [[ ! -f target/mari-ingestion.jar || ! -f target/runtime-classpath.txt ]]; then
  echo 'Run ./build.sh once first (local Java build).' >&2
  exit 1
fi
# No arguments/--validate = offline validation; --apply = validate writer schemas and create missing tables.
exec "${JAVA_HOME:+$JAVA_HOME/bin/}java" -cp "target/mari-ingestion.jar:$(cat target/runtime-classpath.txt)" local.mari.SchemaApply "${MARI_INGESTION_CONFIG:-ingestion.yaml}" "$@"
