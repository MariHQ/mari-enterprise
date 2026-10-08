FROM quay.io/strimzi/kafka:1.2.0-kafka-4.3.1
USER root
RUN mkdir -p /opt/kafka/plugins/debezium-postgres \
 && curl -fsSL https://repo.maven.apache.org/maven2/io/debezium/debezium-connector-postgres/3.3.0.Final/debezium-connector-postgres-3.3.0.Final-plugin.tar.gz \
 | tar xz -C /opt/kafka/plugins/debezium-postgres
USER 1001
