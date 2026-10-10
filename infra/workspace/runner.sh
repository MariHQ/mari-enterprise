#!/bin/sh
set -eu
mkdir -p /workspace/logs/guest /workspace/agent
exec /usr/local/bin/ax-task-runner-bin --http-upstream=http://127.0.0.1:8080 --log-dir=/workspace/logs/guest --state-dir=/workspace/agent/ax
