"""Shared transport for app-owned Cypher; one embedded session per request."""
import logging
import os
from functools import wraps
from fastapi import HTTPException
from apps.base.catalog.engine import IcebergGraph
from apps.base.ingestion.records import hydrate
engine=IcebergGraph()

def execute(query,parameters=None,language='cypher',limit=1000,table=None):
    try:
        return engine.execute(query,parameters,language,os.getenv('MARI_KNOWLEDGE_PROJECT_ID','1'),limit,physical_table=table)
    except ValueError as error:
        raise HTTPException(400,str(error)) from None
    except Exception:
        logging.exception('Knowledge query failed')
        raise HTTPException(503,'Knowledge query unavailable; no stale local copy was returned') from None


def graph_snapshot(function=None):
    """Reuse one resolved graph and connection for a bounded request."""
    if function is None:return lambda fn:graph_snapshot(fn)
    @wraps(function)
    def wrapped(*args,**kwargs):
        try:
            with engine.session(os.getenv('MARI_KNOWLEDGE_PROJECT_ID','1')):
                return function(*args,**kwargs)
        except HTTPException:
            raise
        except Exception:
            logging.exception('Knowledge graph session failed')
            raise HTTPException(503,'Knowledge query unavailable; retry shortly') from None
    return wrapped


