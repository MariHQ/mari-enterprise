import unittest
from unittest.mock import patch
from fastapi import HTTPException
from pydantic import ValidationError
from apps.knowledge.writes import WriteInput, publish, retract

class IngestionCommands(unittest.TestCase):
    def test_mismatched_destination_is_rejected_before_kafka(self):
        with self.assertRaises(ValidationError):
            WriteInput(table='mari.records.mari.fact',record_id='fact:1')
        with self.assertRaises(ValidationError):
            WriteInput(table='mari.records.mari.unknown',record_id='x',kind='unknown')

    def test_retract_preserves_source_and_kind(self):
        with patch('apps.knowledge.writes.publish') as send:
            retract('fact:1','mari.records.mari.fact','demo','command:1')
            self.assertEqual(send.call_args.args[0].kind,'fact')
            retract('slack:1','mari.records.slack.message','demo','command:2')
            self.assertEqual(send.call_args.args[0].source,'slack')
            self.assertEqual(send.call_args.args[0].kind,'message')

    def test_oversized_record_cannot_enter_ingestion(self):
        with patch('apps.base.commands.publish_changes') as send:
            with self.assertRaises(HTTPException) as error:
                publish(WriteInput(table='mari.records.mari.document',record_id='x',text='x'*500001),'command','demo')
            self.assertEqual(error.exception.status_code,422)
            send.assert_not_called()
