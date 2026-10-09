#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ "$(uname -s)" == Darwin ]]; then
  export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
fi
# Local Java build; the Dockerfile copies this jar, it does not compile it.
mvn -B clean package dependency:build-classpath -Dmdep.outputFile=target/runtime-classpath.txt
printf '\nBuilt %s/target/mari-ingestion.jar\n' "$PWD"
