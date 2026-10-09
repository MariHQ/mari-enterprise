"""Compaction catalog preflight stays inside its Temporal heartbeat deadline."""
import asyncio
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from temporal.maintenance.compaction import preflight_with_heartbeats

class PreflightHeartbeatTests(unittest.IsolatedAsyncioTestCase):
    async def test_preflight_heartbeats_while_read_only_inspection_is_pending(self):
        completed=asyncio.Event()
        beats=[]
        async def inspection(function,request):
            await completed.wait()
            return False
        def heartbeat(details):
            beats.append(details)
            if len(beats)==3:completed.set()
        with patch('asyncio.to_thread',side_effect=inspection),patch('temporal.maintenance.compaction.activity.heartbeat',side_effect=heartbeat):
            result=await asyncio.wait_for(preflight_with_heartbeats({},interval=0.001),timeout=1)
        self.assertFalse(result)
        self.assertEqual(len(beats),3)
        self.assertTrue(all(beat['phase']=='preflight' for beat in beats))

    async def test_preflight_propagates_errors_without_starting_job(self):
        with patch('temporal.maintenance.compaction.maintenance_required',side_effect=ValueError('invalid allowlist')),patch('temporal.maintenance.compaction.activity.heartbeat'):
            with self.assertRaisesRegex(ValueError,'invalid allowlist'):
                await preflight_with_heartbeats({})
