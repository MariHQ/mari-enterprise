# Toolchain image. AX clones each app into the durable workspace once.
ARG MARI_APP_BASE=mari-app-base:local
FROM node:22-bookworm-slim AS node
FROM mari-miner:local AS coding
FROM ${MARI_APP_BASE}
USER root
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates curl procps && rm -rf /var/lib/apt/lists/*
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm
COPY --from=coding /root/.local/share/claude /opt/claude
RUN ln -s /opt/claude/versions/2.1.283 /usr/local/bin/claude
COPY --from=runner /ax-task-runner /usr/local/bin/ax-task-runner-bin
COPY infra/workspace/runner.sh /usr/local/bin/ax-task-runner
RUN chmod +x /usr/local/bin/ax-task-runner
COPY apps/base/web/package*.json /opt/mari-web/
RUN npm --prefix /opt/mari-web ci
ENV PYTHONPATH=/workspace/mari:/opt/mari PORT=8080 MARI_ENTRYPOINT=apps.lineage.server:app \
    MARI_STATIC_DIR=/workspace/mari/apps/lineage/web/dist CLAUDE_CONFIG_DIR=/workspace/agent/claude
ENTRYPOINT ["/usr/local/bin/ax-task-runner"]
