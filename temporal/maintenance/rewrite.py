"""One sequential catalog maintenance pass; healthy tables incur no writes."""
import os
import re
import sys


def needs_maintenance(data_files, small_files, delete_files, manifests):
    return small_files >= 2 or delete_files > 0 or manifests >= 8


def quoted_identifier(parts):
    return '.'.join('`'+part.replace('`','``')+'`' for part in parts)


def discover_tables(spark):
    # SparkCatalog exposes namespace operations even when its underlying Iceberg
    # table catalog is a CachingCatalog that has no SupportsNamespaces methods.
    found=set(); visited=set()
    def visit(namespace):
        if namespace in visited:return
        visited.add(namespace)
        location=quoted_identifier(('mari',)+namespace)
        if namespace:
            for row in spark.sql('SHOW TABLES IN '+location).collect():
                if not row.isTemporary:found.add('.'.join(namespace+(row.tableName,)))
        for row in spark.sql('SHOW NAMESPACES IN '+location).collect():
            child=tuple(row[0].split('.'))
            # Spark returns the complete namespace; tolerate relative children.
            if namespace and child[:len(namespace)]!=namespace:child=namespace+child
            visit(child)
    visit(())
    return sorted(found)


def maintain(spark, table):
    from dangling import remove_obsolete_deletes
    # Restrict identifiers before constructing maintenance SQL.
    if not re.fullmatch(r'[a-zA-Z_][a-zA-Z_0-9]*\.[a-zA-Z0-9_.-]+',table):
        raise ValueError('Invalid catalog table name')
    namespace, name = table.split('.', 1)
    identifier = quoted_identifier(('mari', namespace, name))
    procedure_table = quoted_identifier((namespace, name))
    stats=spark.sql(f"SELECT count_if(content=0) AS data_files, "
        "count_if(content=0 AND file_size_in_bytes<67108864) AS small_files, "
        f"count_if(content<>0) AS delete_files FROM {identifier}.files").first()
    manifests=spark.sql(f"SELECT count(*) AS n FROM {identifier}.manifests").first()[0]
    if not needs_maintenance(stats.data_files,stats.small_files,stats.delete_files,manifests):
        print(f"Skipped healthy table {table}: data={stats.data_files}, deletes={stats.delete_files}, manifests={manifests}")
        return False
    spark.sql(f"CALL mari.system.rewrite_data_files(table => '{procedure_table}', strategy => 'binpack', "
        "options => map('target-file-size-bytes','134217728','min-input-files','2', "
        "'delete-file-threshold','1','remove-dangling-deletes','true', "
        "'max-concurrent-file-group-rewrites','1','partial-progress.enabled','false'))").show(truncate=False)
    # 1.11's unpartitioned action assumes implicit cleanup, but its manifest
    # prefilter skips old-sequence deletes when no files are explicitly removed.
    # Use the same conservative sequence rule with an explicit native rewrite.
    # https://github.com/apache/iceberg/blob/apache-iceberg-1.11.0/core/src/main/java/org/apache/iceberg/ManifestFilterManager.java
    # https://github.com/apache/iceberg/blob/apache-iceberg-1.11.0/spark/v3.5/spark/src/main/java/org/apache/iceberg/spark/actions/RemoveDanglingDeletesSparkAction.java
    iceberg_table = spark._jvm.org.apache.iceberg.spark.Spark3Util.loadIcebergTable(
        spark._jsparkSession, identifier)
    removed = remove_obsolete_deletes(iceberg_table, spark._jvm.org.apache.iceberg.ManifestFiles)
    print(f"Removed {removed} obsolete delete-file references; retained snapshots and S3 files are unchanged.")
    spark.sql(f"CALL mari.system.rewrite_manifests(table => '{procedure_table}')").show(truncate=False)
    return True


def main():
    from pyspark.sql import SparkSession
    from catalog import spark_catalog_properties, maintenance_tables
    if len(sys.argv)>2:raise ValueError('Supply at most one allowlisted table')
    tables=maintenance_tables(sys.argv[1] if len(sys.argv)==2 else None)
    builder=(SparkSession.builder.master('local[2]').appName('mari-iceberg-compaction')
        .config('spark.sql.extensions','org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions')
        .config('spark.sql.catalog.mari','org.apache.iceberg.spark.SparkCatalog'))
    for key,value in spark_catalog_properties().items():
        builder=builder.config('spark.sql.catalog.mari.'+key,value)
    spark=builder.getOrCreate()
    try:
        rewritten=0
        for table in tables:
            rewritten+=int(maintain(spark,table))
        print(f"Catalog maintenance complete: checked={len(tables)}, rewritten={rewritten}")
    finally:spark.stop()


if __name__=='__main__':main()
# Snapshot expiration and orphan-file deletion remain separate operations.
