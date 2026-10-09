# Build context: repository root. Reuse the base's prebuilt OrchidDB release.
ARG MARI_APP_BASE=mari-app-base:local
FROM python:3.12-slim AS protocol-build
RUN pip install --no-cache-dir grpcio-tools==1.76.0
COPY infra/ax/proto /proto/ax
RUN mkdir /generated && python -m grpc_tools.protoc -I/proto/ax --python_out=/generated --grpc_python_out=/generated /proto/ax/ax.proto /proto/ax/guest.proto

FROM ${MARI_APP_BASE}
USER root
COPY apps/base/requirements.txt /requirements/apps/base/requirements.txt
COPY temporal/requirements.txt /requirements/temporal/requirements.txt
RUN pip install --no-cache-dir -r /requirements/temporal/requirements.txt
COPY vendor/mari-kit-runtime/src /kit
COPY temporal /app/temporal
COPY --from=protocol-build /generated/ /app/
COPY vendor/mari-kit/packages/mari-core /packages/core
COPY vendor/mari-kit/packages/mari-trajectories /packages/trajectories
RUN pip install --no-cache-dir /packages/core /packages/trajectories && rm -rf /packages
ENV PYTHONPATH=/app:/opt/mari:/kit ORCHID_GRAPH=temporal
USER 65532:65532
HEALTHCHECK NONE
ENTRYPOINT ["python", "-m", "temporal.worker"]
