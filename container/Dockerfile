# One application Dockerfile: --build-arg APP_DIR=apps/sources or container.
ARG MARI_APP_BASE=mari-app-base:local
FROM node:22-bookworm-slim AS web
WORKDIR /workspace
COPY apps/base/web/package*.json /workspace/apps/base/web/
RUN npm --prefix /workspace/apps/base/web ci
COPY apps/base/web /workspace/apps/base/web
COPY vendor/mari-design/components /workspace/vendor/mari-design/components
ARG APP_DIR=apps/sources
COPY ${APP_DIR}/web /workspace/${APP_DIR}/web
RUN node apps/base/web/build.mjs build "${APP_DIR}" && cp -a "${APP_DIR}/web/dist" /out

FROM ${MARI_APP_BASE}
ARG APP_DIR=apps/sources
USER root
RUN pip install --no-cache-dir grpcio==1.76.0 protobuf==6.33.6
USER 65532:65532
COPY ${APP_DIR} /app/application
ARG APP_ID=sources
ENV MARI_APP_ID=${APP_ID}
ARG MARI_ENTRYPOINT=application.server:app
ENV MARI_ENTRYPOINT=${MARI_ENTRYPOINT}
COPY --from=web /out /app/static
# Authentication, dependencies, health checks, USER, PORT, and startup are inherited.
