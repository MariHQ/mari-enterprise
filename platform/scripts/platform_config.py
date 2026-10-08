"""Validate configuration before building or reconciling a platform release."""
import json
import re
from pathlib import Path
from urllib.parse import urlparse


def load_platform(path: Path):
    config=json.loads(path.read_text())
    if config['knowledge']['backend'] not in ('duckdb','starrocks'):
        raise ValueError('knowledge.backend must be duckdb or starrocks')
    # Connectors currently share the single local corpus.
    if str(config['knowledge']['project_id'])!='1':
        raise ValueError('This local deployment supports project_id 1')
    vectors=config['vectors']
    if vectors['mode'] not in ('dense','multi'):
        raise ValueError('vectors.mode must be dense or multi')
    for enabled in (config.get('cdc',{}).get('enabled',False),vectors['enabled'],config['quickwit']['enabled'],config['compaction']['enabled']):
        if not isinstance(enabled,bool):raise ValueError('enabled flags must be booleans')
    if vectors['enabled']:
        endpoint=urlparse(vectors['endpoint'])
        if endpoint.scheme not in ('http','https') or not endpoint.netloc:
            raise ValueError('Embedding endpoint must be an HTTP(S) URL')
        if not vectors['model'] or not vectors['topics'] or not vectors['api_key_env']:
            raise ValueError('Enabled embeddings require model, topics, and API key variable')
    minutes=config['compaction'].get('every_minutes',15)
    if type(minutes) is not int or minutes<=0:raise ValueError('Compaction every_minutes must be a positive integer')
    if config['flink']['state'] not in ('suspended','running'):
        raise ValueError('flink.state must be suspended or running')
    if type(config.get('temporal',{}).get('enabled',True)) is not bool:
        raise ValueError('temporal.enabled must be a boolean')
    for rule in config.get('lake',{}).get('partition_rules',[]):
        re.compile(rule['pattern'])
        if type(rule.get('buckets')) is not int or not 0<=rule['buckets']<=1024:
            raise ValueError('Partition buckets must be an integer from 0 to 1024; 0 means unpartitioned')
    return config
