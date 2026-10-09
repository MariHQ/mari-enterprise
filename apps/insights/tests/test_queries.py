import unittest
from unittest.mock import patch
from apps.base.tests.test_lake_bindings import fixture
from apps.insights import projections

class InsightsQueries(unittest.TestCase):
    def test_coverage_counts_sources_and_claims_separately(self):
        with fixture([
            ('mari.records.mari.document',{'record_id':'document'}),
            ('mari.records.slack.message',{'record_id':'message'}),
            ('mari.records.mari.fact',{'record_id':'fact'}),
            ('mari.records.temporal.temporal_run',{'record_id':'run'}),
        ]) as (run,manifest,db):
            with patch.object(projections.reader,'execute',side_effect=run) as query:
                result=projections.page.__wrapped__('insights')
                self.assertEqual(result['metrics'],{'documents':2,'facts':1,'decisions':0,'entities':0,'evidence':0})

    def test_all_empty_content_tables_return_zero(self):
        with fixture() as (run,manifest,db):
            with patch.object(projections.reader,'execute',side_effect=run) as query:
                result=projections.page.__wrapped__('insights')
                self.assertEqual(result['metrics'],{'documents':0,'facts':0,'decisions':0,'entities':0,'evidence':0})
