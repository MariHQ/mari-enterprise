"""Image-build check: verify a coherent catalog-capable OrchidDB release."""
import duckdb
from orchiddb import Catalog, CatalogAuth, Credential, Connection, DuckDBEngine
from orchiddb._runtime import _Runtime


def main():
    runtime = _Runtime()
    try: print('OrchidDB native revision:', runtime.core_revision)
    finally: runtime.close()
    database = duckdb.connect()
    try:
        database.execute('CREATE TABLE people(id BIGINT, name VARCHAR)')
        database.execute("INSERT INTO people VALUES (1, 'Mari')")
        schema = {'tables': [{'name': 'people', 'columns': [
            {'name': 'id', 'data_type': 'int64'}, {'name': 'name', 'data_type': 'string'}]}],
            'nodes': [{'label': 'Person', 'table': 'people', 'id': 'id', 'properties': {'name': 'name'}}], 'edges': []}
        with Connection(DuckDBEngine(database), schema=schema) as graph:
            with graph.query('MATCH (p:Person) RETURN p.name AS name') as result:
                assert result.read_all().to_pylist() == [{'name': 'Mari'}]
    finally: database.close()
    print('OrchidDB catalog API and embedded engine: OK')


if __name__ == '__main__': main()
