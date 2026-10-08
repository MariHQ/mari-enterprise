FROM python:3.12-slim
WORKDIR /app
COPY mari/platform/constraints.txt /app/requirements/constraints.txt
COPY mari/platform/knowledge/requirements.txt /app/requirements/knowledge/requirements.txt
COPY mari/platform/indexing/requirements.txt /app/requirements/indexing/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements/knowledge/requirements.txt
COPY --from=orchiddb-wheel / /wheels/
RUN pip install --no-cache-dir /wheels/*.whl && python -c "from orchiddb._runtime import _Runtime; print(_Runtime().core_revision)" && rm -rf /wheels
RUN mkdir -p /opt/duckdb/extensions && python -c "import duckdb; c=duckdb.connect(config={'extension_directory':'/opt/duckdb/extensions'}); c.execute('INSTALL aws'); c.execute('INSTALL avro'); c.execute('INSTALL iceberg'); c.execute('INSTALL httpfs'); c.execute('INSTALL cache_httpfs FROM community'); c.execute('LOAD iceberg'); c.execute('LOAD cache_httpfs')"
COPY mari/platform/knowledge /app/knowledge
COPY mari/platform/indexing /app/indexing
COPY mari/platform/config /app/config
ENV PYTHONPATH=/app PYTHONUNBUFFERED=1 DUCKDB_EXTENSION_DIRECTORY=/opt/duckdb/extensions
USER 65532:65532
CMD ["uvicorn","knowledge.service:app","--host","0.0.0.0","--port","8000"]
