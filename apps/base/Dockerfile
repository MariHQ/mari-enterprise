# Context: mari/. OrchidDB is always copied from a prebuilt release wheel.
# No Rust compiler, Node toolchain, or source build is included in this image.
FROM python:3.12-slim-bookworm
WORKDIR /app
COPY apps/base/requirements.txt /opt/mari/requirements.txt
RUN pip install --no-cache-dir -r /opt/mari/requirements.txt
COPY --from=orchiddb-wheel / /tmp/orchiddb-wheel/
RUN pip install --no-cache-dir /tmp/orchiddb-wheel/*.whl && rm -rf /tmp/orchiddb-wheel
COPY apps/base/runtime.py apps/base/serve.py apps/base/db.py apps/base/commands.py /opt/mari/apps/base/
COPY apps/base/scripts/check_runtime.py /opt/mari/check_runtime.py
# Reject mismatched Python/native releases and packages without catalog support.
RUN python /opt/mari/check_runtime.py
ENV PYTHONPATH=/opt/mari:/app PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 \
    MARI_EMBEDDED_RUNTIME=true MARI_STATIC_DIR=/app/static PORT=8080 \
    HOME=/tmp/mari DUCKDB_EXTENSION_DIRECTORY=/opt/mari/duckdb
RUN mkdir -p /opt/mari/duckdb && python -c "import duckdb; c=duckdb.connect(config={'extension_directory':'/opt/mari/duckdb'}); [c.execute('INSTALL '+e) for e in ('aws','avro','iceberg')]; c.execute('INSTALL cache_httpfs FROM community'); c.execute('LOAD cache_httpfs'); c.execute('LOAD iceberg')"
COPY apps/base/catalog /opt/mari/apps/base/catalog
COPY apps/base/ingestion /opt/mari/apps/base/ingestion
COPY flink/ingestion.yaml /opt/mari/flink/ingestion.yaml
COPY apps/base/schemas /opt/mari/schemas
ENV MARI_SCHEMA_DIR=/opt/mari/schemas MARI_INGESTION_CONFIG=/opt/mari/flink/ingestion.yaml
RUN python -c "from apps.base.db import engine; from apps.base.commands import WriteInput; from apps.base.catalog.provision import topics; assert topics()"
USER 65532:65532
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.getenv('PORT','8080')+'/healthz',timeout=2)"
ENTRYPOINT ["python", "-m", "apps.base.serve"]
