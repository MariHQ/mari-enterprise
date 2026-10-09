"""Each app owns its embedded OrchidDB engine; the shared catalog is metadata."""
import os
from pathlib import Path
from contextlib import contextmanager


@contextmanager
def connect():
    import duckdb
    from orchiddb import Catalog, CatalogAuth, Connection, Credential, DuckDBEngine
    # Bootstrap bindings are trusted deployment files, never request input.
    # They bind the graph's physical sources using the app's read-only credentials.
    binding_path = os.getenv('ORCHID_BINDINGS_SQL')
    graph_name = os.getenv('ORCHID_GRAPH')
    if not binding_path or not graph_name:
        raise ValueError('Configure ORCHID_GRAPH and ORCHID_BINDINGS_SQL for this application')
    database = duckdb.connect(config={'memory_limit': '256MB', 'threads': 2,
        'extension_directory': os.getenv('DUCKDB_EXTENSION_DIRECTORY', os.path.expanduser('~/.duckdb/extensions'))})
    connection = None
    try:
        database.execute(Path(binding_path).read_text())
        auth = None
        if os.getenv('ORCHID_CATALOG_CLIENT_ID'):
            auth = CatalogAuth.client_credentials(os.environ['ORCHID_CATALOG_CLIENT_ID'], Credential.env('ORCHID_CATALOG_CLIENT_SECRET'))
        catalog = Catalog(os.getenv('ORCHID_CATALOG_URL', 'http://orchid-catalog.stack.svc:8182'),
                          scope=os.getenv('ORCHID_SCOPE', 'mari'), graph=graph_name, auth=auth)
        connection = Connection(DuckDBEngine(database), catalog=catalog)
        yield connection
    finally:
        if connection is not None:
            connection.close()
        database.close()


def query_pages(query, parameters):
    """App-owned bounded queries only; the HTTP API never accepts arbitrary SQL."""
    with connect() as graph:
        pages = []
        for values in parameters:
            with graph.query(query, parameters=values) as result:
                pages.append(result.read_all().to_pylist())
        return pages
