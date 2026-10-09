"""Polaris configuration shared by the Temporal preflight and Spark rewrite job."""
import json
import os
import re


def catalog_properties():
    properties = {
        'type': 'rest',
        'uri': os.getenv('ICEBERG_REST_URI', 'http://polaris.stack.svc:8181/api/catalog'),
        'warehouse': os.getenv('ICEBERG_WAREHOUSE', 'lake'),
        'scope': os.getenv('ICEBERG_OAUTH_SCOPE', 'PRINCIPAL_ROLE:ALL'),
    }
    if os.getenv('ICEBERG_CREDENTIAL'):
        properties['credential'] = os.environ['ICEBERG_CREDENTIAL']
    if os.getenv('ICEBERG_CATALOG_PROPERTIES'):
        properties.update(json.loads(os.environ['ICEBERG_CATALOG_PROPERTIES']))
    if properties.get('type') != 'rest':
        raise ValueError('The shared stack requires a Polaris REST catalog')
    return properties


def spark_catalog_properties():
    properties = catalog_properties()
    properties.pop('type')
    return {'type': 'rest', **properties, 'io-impl': 'org.apache.iceberg.aws.s3.S3FileIO'}


def maintenance_tables(table=None):
    tables = [value.strip() for value in os.getenv('ICEBERG_MAINTENANCE_TABLES', '').split(',') if value.strip()]
    if not tables:
        raise ValueError('Set ICEBERG_MAINTENANCE_TABLES to an explicit table allowlist')
    if any(not re.fullmatch(r'[a-zA-Z_][a-zA-Z_0-9]*\.[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*', value) for value in tables):
        raise ValueError('Maintenance tables must be namespace.table identifiers')
    if table is not None:
        if table not in tables:
            raise ValueError('Requested table is outside ICEBERG_MAINTENANCE_TABLES')
        return [table]
    return list(dict.fromkeys(tables))
