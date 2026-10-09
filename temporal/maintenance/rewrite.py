"""One sequential catalog maintenance pass; healthy tables incur no writes."""
import os
import re
import sys


MIN_SMALL_FILES = 8
MIN_DELETE_FILES = 8
MIN_MANIFESTS = 16


def needs_maintenance(data_files, small_files, delete_files, manifests):
    return small_files >= MIN_SMALL_FILES or delete_files >= MIN_DELETE_FILES or manifests >= MIN_MANIFESTS


def file_stats(table, manifest_files):
    """Read native Iceberg manifests, without launching Spark aggregation jobs."""
    from dangling import _files
    table.refresh()
    snapshot=table.currentSnapshot()
    if snapshot is None:return 0,0,0,0
    manifests=list(snapshot.allManifests(table.io()))
    data=small=deletes=0
    for manifest in manifests:
        is_data=str(manifest.content())=='DATA'
        reader=(manifest_files.read(manifest,table.io()) if is_data else
                manifest_files.readDeleteManifest(manifest,table.io(),table.specs()))
        try:
            for file in _files(reader):
                if is_data:
                    data+=1;small+=int(file.fileSizeInBytes()<67108864)
                else:deletes+=1
        finally:reader.close()
    return data,small,deletes,len(manifests)


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


def manifest_replaced_concurrently(error):
    """Only the known failed optimistic validation is safe to re-plan here."""
    java_error = getattr(error, 'java_exception', None)
    if java_error is None:
        return False
    if java_error.getClass().getName() != 'org.apache.iceberg.exceptions.ValidationException':
        return False
    return re.fullmatch(r'Deleted manifest .+ could not be found in the latest snapshot [0-9]+',
                        java_error.getMessage() or '') is not None


def rewrite_manifests(spark, identifier, procedure_table):
    # Flink can replace manifests between Spark planning and commit. Rebuild only
    # this optional optimization; never replay data rewrites or ignore unknown commits.
    for attempt in range(3):
        try:
            spark.sql(f"CALL mari.system.rewrite_manifests(table => '{procedure_table}')").show(truncate=False)
            return True
        except Exception as error:
            if not manifest_replaced_concurrently(error):
                raise
            if attempt == 2:
                print(f"Deferred manifest rewrite for {procedure_table}: concurrent ingestion replaced manifests on all 3 attempts")
                return False
            spark.catalog.refreshTable(identifier)
            print(f"Retrying manifest rewrite for {procedure_table} after concurrent ingestion (attempt {attempt + 2}/3)")


def maintain(spark, table):
    from dangling import remove_obsolete_deletes
    # Restrict identifiers before constructing maintenance SQL.
    if not re.fullmatch(r'[a-zA-Z_][a-zA-Z_0-9]*\.[a-zA-Z0-9_.-]+',table):
        raise ValueError('Invalid catalog table name')
    namespace, name = table.split('.', 1)
    identifier = quoted_identifier(('mari', namespace, name))
    procedure_table = quoted_identifier((namespace, name))
    iceberg_table=spark._jvm.org.apache.iceberg.spark.Spark3Util.loadIcebergTable(spark._jsparkSession,identifier)
    manifest_files=spark._jvm.org.apache.iceberg.ManifestFiles
    data,small,deletes,manifests=file_stats(iceberg_table,manifest_files)
    if not needs_maintenance(data,small,deletes,manifests):
        print(f"Skipped healthy table {table}: data={data}, deletes={deletes}, manifests={manifests}")
        return False
    if small>=MIN_SMALL_FILES or deletes>=MIN_DELETE_FILES:
        spark.sql(f"CALL mari.system.rewrite_data_files(table => '{procedure_table}', strategy => 'binpack', "
            f"options => map('target-file-size-bytes','134217728','min-input-files','{MIN_SMALL_FILES}', "
            "'delete-file-threshold','1','remove-dangling-deletes','true', "
            "'max-concurrent-file-group-rewrites','1','partial-progress.enabled','false'))").show(truncate=False)
    # 1.11's unpartitioned action assumes implicit cleanup, but its manifest
    # prefilter skips old-sequence deletes when no files are explicitly removed.
    # Use the same conservative sequence rule with an explicit native rewrite.
    # https://github.com/apache/iceberg/blob/apache-iceberg-1.11.0/core/src/main/java/org/apache/iceberg/ManifestFilterManager.java
    # https://github.com/apache/iceberg/blob/apache-iceberg-1.11.0/spark/v3.5/spark/src/main/java/org/apache/iceberg/spark/actions/RemoveDanglingDeletesSparkAction.java
    removed = remove_obsolete_deletes(iceberg_table, manifest_files)
    print(f"Removed {removed} obsolete delete-file references; retained snapshots and S3 files are unchanged.")
    if manifests>=MIN_MANIFESTS:rewrite_manifests(spark, identifier, procedure_table)
    return True


def main():
    from pyspark.sql import SparkSession
    from catalog import spark_catalog_properties, maintenance_tables
    if len(sys.argv)>2:raise ValueError('Supply at most one allowlisted table')
    tables=maintenance_tables(sys.argv[1] if len(sys.argv)==2 else None)
    builder=(SparkSession.builder.appName('mari-iceberg-compaction')
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
