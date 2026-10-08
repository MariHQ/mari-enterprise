FROM apache/spark:3.5.5-scala2.12-java17-python3-ubuntu@sha256:96dc2bada923824300e1ece564389258934655ba6f463d6daff8753ff0c639ce
USER root
ADD https://repo1.maven.org/maven2/org/apache/iceberg/iceberg-spark-runtime-3.5_2.12/1.11.0/iceberg-spark-runtime-3.5_2.12-1.11.0.jar /opt/spark/jars/iceberg-runtime.jar
ADD https://repo1.maven.org/maven2/org/apache/iceberg/iceberg-aws-bundle/1.11.0/iceberg-aws-bundle-1.11.0.jar /opt/spark/jars/iceberg-aws.jar
ADD https://repo1.maven.org/maven2/org/postgresql/postgresql/42.7.5/postgresql-42.7.5.jar /opt/spark/jars/postgresql.jar
COPY mari/platform/maintenance/rewrite.py mari/platform/maintenance/dangling.py /opt/spark/
RUN chmod 644 /opt/spark/jars/*.jar /opt/spark/rewrite.py /opt/spark/dangling.py
USER 185
ENTRYPOINT ["/opt/spark/bin/spark-submit", "/opt/spark/rewrite.py"]
