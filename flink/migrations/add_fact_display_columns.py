"""Add the five existing Facts UI fields to its two physical tables and writers.

Defaults to validation only. --apply changes table metadata and registers only
these two value schemas; it never rewrites data or changes keys/partitions.
"""
import argparse
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen
from pyiceberg.catalog import load_catalog
from pyiceberg.types import StringType

TOPICS = ('mari.records.mari.fact', 'mari.records.agent.fact')
FIELDS = ('source_label', 'owner', 'verified_at', 'captured_at', 'valid_from')


def registry(path, body=None):
    request = Request(os.getenv('SCHEMA_REGISTRY_URL', 'http://schema-registry.stack.svc:8081') + path,
                      data=None if body is None else json.dumps(body).encode(),
                      headers={'Content-Type': 'application/vnd.schemaregistry.v1+json'})
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def migrate(schema_dir, apply=False):
    catalog = load_catalog('mari', type='rest',
        uri=os.getenv('ICEBERG_REST_URI', 'http://polaris.stack.svc:8181/api/catalog'),
        warehouse=os.getenv('ICEBERG_WAREHOUSE', 'lake'),
        credential=os.environ['ICEBERG_CREDENTIAL'], scope='PRINCIPAL_ROLE:ALL')
    plan = []
    # Validate both destinations and writer compatibility before changing either.
    for topic in TOPICS:
        definition = json.loads((schema_dir / (topic + '.avsc')).read_text())
        declared = {field['name']: field for field in definition['fields']}
        for name in FIELDS:
            if declared[name]['type'] != ['null', 'string'] or declared[name].get('default', 'missing') is not None:
                raise ValueError('Expected nullable string with null default: ' + topic + '.' + name)
        table = catalog.load_table(('mari', topic))
        existing = {field.name: field for field in table.schema().fields}
        for name in FIELDS:
            if name in existing and (existing[name].field_type != StringType() or existing[name].required):
                raise ValueError('Existing field is not an optional string: ' + topic + '.' + name)
        subject = topic + '-value'
        prior = json.loads(registry('/subjects/' + subject + '/versions/latest')['schema'])
        without_additions = lambda value: {**value, 'fields': [field for field in value['fields'] if field['name'] not in FIELDS]}
        if without_additions(prior) != without_additions(definition):
            raise ValueError('Unexpected writer changes outside the five fields: ' + subject)
        schema = {'schemaType': 'AVRO', 'schema': json.dumps(definition)}
        if not registry('/compatibility/subjects/' + subject + '/versions/latest', schema)['is_compatible']:
            raise ValueError('Writer schema is incompatible: ' + subject)
        plan.append((topic, table, [name for name in FIELDS if name not in existing], schema))
    for topic, table, missing, schema in plan:
        if apply:
            if missing:
                with table.update_schema() as update:
                    for name in missing: update.add_column(name, StringType(), required=False)
            registry('/subjects/' + topic + '-value/versions', schema)
            table.refresh()
        latest = registry('/subjects/' + topic + '-value/versions/latest')
        fields = {field.name: field for field in table.schema().fields}
        print(json.dumps({'table': topic, 'applied': apply, 'missing_before': missing,
            'fields': [{'name': name, 'field_id': fields[name].field_id, 'type': str(fields[name].field_type), 'required': fields[name].required} for name in FIELDS if name in fields],
            'writer_version': latest['version'], 'writer_schema_id': latest['id']}), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--schema-dir', type=Path, default=Path('apps/base/schemas'))
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    migrate(args.schema_dir, args.apply)
