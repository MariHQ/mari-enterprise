# Context: mari/. OrchidDB is always copied from a prebuilt release wheel.
# No Rust compiler, Node toolchain, or source build is included in this image.
FROM python:3.12-slim-bookworm
WORKDIR /app
COPY apps/base/requirements.txt /opt/mari/requirements.txt
RUN pip install --no-cache-dir -r /opt/mari/requirements.txt
COPY --from=orchiddb-wheel / /tmp/orchiddb-wheel/
RUN pip install --no-cache-dir /tmp/orchiddb-wheel/*.whl && rm -rf /tmp/orchiddb-wheel
COPY apps/sdk /opt/mari/apps/sdk
COPY flink/ingestion.yaml /opt/mari/ingestion.yaml
ENV MARI_INGESTION_CONFIG=/opt/mari/ingestion.yaml
COPY apps/base/scripts/check_runtime.py /opt/mari/check_runtime.py
# Reject mismatched Python/native releases and packages without catalog support.
RUN python /opt/mari/check_runtime.py
ENV PYTHONPATH=/opt/mari:/app PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 \
    MARI_EMBEDDED_RUNTIME=true MARI_STATIC_DIR=/app/static PORT=8080 \
    HOME=/tmp/mari DUCKDB_EXTENSION_DIRECTORY=/opt/mari/duckdb
RUN mkdir -p /opt/mari/duckdb && python -c "import duckdb; c=duckdb.connect(config={'extension_directory':'/opt/mari/duckdb'}); [c.execute('INSTALL '+e) for e in ('httpfs','aws','iceberg','postgres')]"
USER 65532:65532
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.getenv('PORT','8080')+'/healthz',timeout=2)"
ENTRYPOINT ["python", "-m", "apps.sdk.serve"]
