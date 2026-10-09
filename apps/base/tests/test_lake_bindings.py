"""Project isolation and graph bindings against local normalized Flink output."""
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import duckdb
import pyarrow as pa
import pyarrow.parquet as pq

MARI=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(MARI))
from apps.sdk.catalog_lake import bind,LazyViews
from apps.sdk.provision import definitions,topics,table_name

class BindingsTests(unittest.TestCase):
    def test_current_history_project_and_edges(self):
        with tempfile.TemporaryDirectory() as tmp:
            rows=[]
            for offset,project,id,operation,title,properties in [
                (1,'1','a','upsert','old',{}),(2,'1','a','upsert','new',{'supporting_record_ids':['b']}),
                (3,'1','b','upsert','evidence',{}),(4,'1','gone','upsert','delete me',{}),
                (5,'1','gone','delete','',{}),(6,'other','a','upsert','private',{})]:
                rows.append(dict(kafka_offset=offset,kafka_partition=0,project_id=project,record_id=id,event_id=str(offset),operation=operation,kind='fact',source='mari',title=title,text='',url='',properties=json.dumps(properties),actor='demo',observed_at=1))
            tables={};objects={};topic='mari.records.mari.fact'
            for namespace,values in [('mari_streams',[rows[i] for i in (1,2,5)]),('mari_history',rows)]:
                path=Path(tmp)/(namespace+'.parquet');pq.write_table(pa.Table.from_pylist(values),path)
                tables[(namespace,topic)]=SimpleNamespace(current_snapshot=lambda count=len(values):SimpleNamespace(summary={'total-records':str(count)}),metadata_location=str(path),metadata=SimpleNamespace(table_uuid=namespace,current_schema_id=0))
                objects[namespace]={'definition':{'iceberg':{'namespace':[namespace],'table':topic,'table_uuid':namespace}}}
            database=duckdb.connect()
            class LocalFiles:
                def execute(self,sql):return database.execute(sql.replace('iceberg_scan(', 'read_parquet('))
            with patch('pyiceberg.catalog.load_catalog',return_value=SimpleNamespace(load_table=lambda key:tables[key])):
                views=LazyViews(LocalFiles());bind(views,{'objects':objects},'1')
                for name in views.statements:views.ensure(name)
            self.assertEqual(database.execute('SELECT record_id,title FROM graph_records ORDER BY record_id').fetchall(),[('a','new'),('b','evidence')])
            self.assertEqual(database.execute('SELECT from_id,to_id FROM edge_supported_by').fetchall(),[('a','b')])
            self.assertEqual(database.execute('SELECT count(*) FROM history').fetchone()[0],5)
            self.assertEqual(database.execute('SELECT stream_offset,"table" FROM graph_records WHERE record_id=\'a\'').fetchone(),(2,topic))
            physical=[d for d in definitions(tables).values() if 'iceberg' in d]
            self.assertEqual(len(physical),2)
            self.assertTrue(all(len(d['columns'])==14 for d in physical))
            with patch('pyiceberg.catalog.load_catalog',return_value=SimpleNamespace(load_table=lambda key:tables[key])):
                current=LazyViews(database)
                bind(current,{'objects':objects},'1',namespace_filter='mari_streams')
                self.assertIn('graph_records',current.statements)
                self.assertNotIn('history',current.statements)
                history=LazyViews(database)
                bind(history,{'objects':objects},'1',namespace_filter='mari_history')
                self.assertIn('history',history.statements)
                self.assertNotIn('graph_records',history.statements)
            database.close()

    def test_topics_and_logical_graph(self):
        self.assertTrue(all(t.startswith('mari.records.') for t in topics()))
        self.assertEqual(len(topics()),len(set(topics())))
        for topic in topics():self.assertEqual(table_name(topic),topic)
        objects=definitions({})
        self.assertIn('node_fact',objects)
        self.assertIn('edge_supported_by',objects)
        self.assertEqual(objects['related']['source'],'record')
