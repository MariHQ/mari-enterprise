FROM python:3.12-slim AS protocol-build
WORKDIR /build
COPY mari/platform/constraints.txt mari/platform/requirements-build.txt ./
RUN pip install --no-cache-dir -r requirements-build.txt
COPY mari/platform/substrate/proto /proto/substrate
COPY mari/platform/ax/proto /proto/ax
RUN mkdir /generated && python -m grpc_tools.protoc -I/proto/substrate --python_out=/generated --grpc_python_out=/generated /proto/substrate/ateapi.proto \
 && python -m grpc_tools.protoc -I/proto/ax --python_out=/generated --grpc_python_out=/generated /proto/ax/ax.proto /proto/ax/guest.proto

FROM python:3.12-slim
WORKDIR /app
COPY mari/platform/constraints.txt /app/requirements/constraints.txt
COPY mari/platform/runtime/requirements.txt /app/requirements/runtime/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements/runtime/requirements.txt
COPY mari-kit/src /kit
COPY mari/platform/runtime /app/runtime
COPY mari/platform/knowledge /app/knowledge
COPY mari/platform/maintenance /app/maintenance
COPY --from=protocol-build /generated/ /app/
COPY mari/vendor/mari-kit/packages/mari-core /packages/core
COPY mari/vendor/mari-kit/packages/mari-trajectories /packages/trajectories
RUN pip install --no-cache-dir /packages/core /packages/trajectories && rm -rf /packages
COPY mari/platform/config /app/config
ENV PYTHONPATH=/app:/kit PYTHONUNBUFFERED=1
USER 65532:65532
CMD ["uvicorn", "runtime.api:app", "--host", "0.0.0.0", "--port", "8000"]
