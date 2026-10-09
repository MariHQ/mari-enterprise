FROM flink:1.20.1-scala_2.12-java17
USER root
RUN mkdir -p /opt/flink/plugins/s3-fs-hadoop && cp /opt/flink/opt/flink-s3-fs-hadoop-*.jar /opt/flink/plugins/s3-fs-hadoop/ \
 && curl -fsSL https://repo.maven.apache.org/maven2/org/apache/flink/flink-sql-connector-kafka/3.3.0-1.20/flink-sql-connector-kafka-3.3.0-1.20.jar -o /opt/flink/lib/kafka.jar \
 && curl -fsSL https://repo.maven.apache.org/maven2/org/apache/iceberg/iceberg-flink-runtime-1.20/1.11.0/iceberg-flink-runtime-1.20-1.11.0.jar -o /opt/flink/lib/iceberg.jar \
 && curl -fsSL https://repo.maven.apache.org/maven2/org/apache/iceberg/iceberg-aws-bundle/1.11.0/iceberg-aws-bundle-1.11.0.jar -o /opt/flink/lib/iceberg-aws.jar
RUN curl -fsSL https://repo.maven.apache.org/maven2/com/fasterxml/jackson/core/jackson-databind/2.18.3/jackson-databind-2.18.3.jar -o /opt/flink/lib/jackson-databind.jar \
 && curl -fsSL https://repo.maven.apache.org/maven2/com/fasterxml/jackson/core/jackson-core/2.18.3/jackson-core-2.18.3.jar -o /opt/flink/lib/jackson-core.jar \
 && curl -fsSL https://repo.maven.apache.org/maven2/com/fasterxml/jackson/core/jackson-annotations/2.18.3/jackson-annotations-2.18.3.jar -o /opt/flink/lib/jackson-annotations.jar
RUN curl -fsSL https://repo.maven.apache.org/maven2/org/apache/hadoop/hadoop-client-api/3.3.6/hadoop-client-api-3.3.6.jar -o /opt/flink/lib/hadoop-client-api.jar \
 && curl -fsSL https://repo.maven.apache.org/maven2/org/apache/hadoop/hadoop-client-runtime/3.3.6/hadoop-client-runtime-3.3.6.jar -o /opt/flink/lib/hadoop-client-runtime.jar
COPY target/mari-ingestion.jar /opt/flink/usrlib/mari-ingestion.jar
COPY ingestion.yaml /opt/mari/ingestion.yaml
ENV MARI_INGESTION_CONFIG=/opt/mari/ingestion.yaml
USER flink
