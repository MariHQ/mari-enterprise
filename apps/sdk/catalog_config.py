"""Polaris connection configuration shared by embedded app engines."""
import os
import json

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

