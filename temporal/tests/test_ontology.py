import unittest
from unittest.mock import patch
from types import SimpleNamespace
from mari_kit.ontology import context_key,windows,candidates,identity
from mari_kit.ingestion import normalize
from apps.base.ingestion.evidence import check_approval
from fastapi import HTTPException

class OntologyTests(unittest.TestCase):
    def source(self,text='Use Postgres.',revision='v1'):
        return {'source_id':'T/C/1.000000','node_type':'SlackMessage','event_id':revision,'text':text,'title':'Message','properties':{'thread_root':'T/C/1.000000','collection_id':'channel:C'}}
    def result(self):
        return {'entities':[{'name':'Mari','type':'system'},{'name':'Postgres','type':'system'}],
            'claims':[{'kind':'decision','statement':'Mari uses Postgres.','subject':'Mari','predicate':'uses','object':'Postgres','value':'','context':'Storage choice','evidence':[{'source_id':'T/C/1.000000','quote':'Use Postgres.'}]}]}
    def test_thread_root_gives_shared_context(self):
        root=self.source();reply={**root,'source_id':'T/C/2.000000'}
        self.assertEqual(context_key(root),context_key(reply))
    def test_window_preserves_complete_long_document(self):
        source=self.source('abcdefghij'*100)
        parts=list(windows([source],maximum_characters=100,overlap=10))
        self.assertEqual(parts[0][0]['text'],source['text'][:100])
        rebuilt=parts[0][0]['text']+''.join(p[0]['text'][10:] for p in parts[1:])
        self.assertEqual(rebuilt,source['text'])
    def test_short_conversation_stays_together(self):
        root=self.source();reply={**root,'source_id':'T/C/2.000000','text':'Agreed, ship it.'}
        self.assertEqual(len(list(windows([root,reply]))[0]),2)
    def test_stable_claim_identity_and_versioned_evidence(self):
        a,_=candidates(self.result(),[self.source()],'thread');b,_=candidates(self.result(),[self.source(revision='v2')],'thread')
        self.assertEqual(a[0]['candidate_id'],b[0]['candidate_id'])
        self.assertNotEqual(a[0]['supporting_evidence_ids'],b[0]['supporting_evidence_ids'])
    def test_unquoted_claim_rejected(self):
        with self.assertRaises(ValueError):candidates(self.result(),[self.source('We rejected Postgres.')],'thread')
    def test_unknown_entity_rejected(self):
        result=self.result();result['claims'][0]['subject']='Unknown'
        with self.assertRaises(ValueError):candidates(result,[self.source()],'thread')
    def test_unused_entities_are_not_persisted(self):
        result=self.result();result['entities'].append({'name':'Unused','type':'concept'})
        _,entities=candidates(result,[self.source()],'thread');self.assertEqual(len(entities),2)
    def test_approval_rechecks_source_revision_and_quote(self):
        claims,_=candidates(self.result(),[self.source()],'thread')
        body=SimpleNamespace(source='agent',kind='decision',properties={**claims[0],'status':'ratified'})
        with self.assertRaises(HTTPException) as e:check_approval(body,lambda *a:{'rows':[{'event_id':'v2','text':'Use Postgres.'}]})
        self.assertEqual(e.exception.status_code,409)
        check_approval(body,lambda *a:{'rows':[{'event_id':'v1','text':'Use Postgres.'}]})
    def test_normalizer_does_not_silently_truncate(self):
        rows=normalize('github',{'repository':{'full_name':'a/b'},'issue':{'id':1,'body':'x'*120000}},'test',1)
        self.assertEqual(len(rows[0].text),120000)
    def test_file_chunks_cover_entire_source(self):
        rows=normalize('github',{'repository':{'full_name':'a/b'},'file':{'path':'README.md','text':'x'*500001,'url':'https://example.test'}},'test',1)
        self.assertEqual(sum(len(r.text) for r in rows),500001)
        self.assertEqual(len({r.source_id for r in rows}),2)
