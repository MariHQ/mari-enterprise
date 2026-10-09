import os,unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock,patch
from temporal.schedules import register_poll,persist_poll_cursor

class DailyScheduleTests(unittest.IsolatedAsyncioTestCase):
 async def test_status_observer_starts_immediately_and_refreshes_every_five_minutes(self):
  c=AsyncMock()
  await register_poll(c,'observe-temporal','observe_temporal',{})
  self.assertEqual(c.create_schedule.call_args.args[1].spec.intervals[0].every.total_seconds(),300)
  self.assertTrue(c.create_schedule.call_args.kwargs['trigger_immediately'])

 async def test_existing_observer_keeps_cursor_and_pause_state(self):
  from datetime import timedelta
  from temporalio.client import ScheduleAlreadyRunningError,ScheduleIntervalSpec
  schedule=SimpleNamespace(action=object(),state=object(),spec=SimpleNamespace(intervals=[ScheduleIntervalSpec(every=timedelta(days=1))]))
  action,state=schedule.action,schedule.state
  async def update(callback):
   result=callback(SimpleNamespace(description=SimpleNamespace(schedule=schedule)))
   self.assertIs(result.schedule.action,action);self.assertIs(result.schedule.state,state)
   self.assertEqual(result.schedule.spec.intervals[0].every.total_seconds(),300)
  c=SimpleNamespace(create_schedule=AsyncMock(side_effect=ScheduleAlreadyRunningError()),get_schedule_handle=lambda _:SimpleNamespace(update=update))
  await register_poll(c,'observe-temporal','observe_temporal',{})

 async def test_daily_registration_preserves_cursor_and_disables_overlap(self):
  from temporalio.client import ScheduleOverlapPolicy
  c=AsyncMock();state={'source':'github','target':'repo','known':{'a':'v1'}}
  await register_poll(c,'poll','sync_source',state,paused=True)
  schedule=c.create_schedule.call_args.args[1]
  self.assertEqual(schedule.spec.intervals[0].every.total_seconds(),86400)
  self.assertEqual(schedule.policy.overlap,ScheduleOverlapPolicy.SKIP)
  self.assertEqual(schedule.action.args[0]['state'],state)
  self.assertTrue(schedule.state.paused)

 @patch.dict(os.environ,{'TEMPORAL_ADDRESS':'test:7233'})
 async def test_cursor_update_preserves_schedule_and_is_idempotent(self):
  initial={'activity':'sync_source','state':{'known':{'a':'old'}}}
  schedule=SimpleNamespace(action=SimpleNamespace(args=[initial]),spec=object(),state=object())
  results=[]
  async def update(callback):results.append(await callback(SimpleNamespace(description=SimpleNamespace(schedule=schedule))))
  client=SimpleNamespace(get_schedule_handle=lambda _:SimpleNamespace(update=update))
  request={'schedule_id':'poll','activity':'sync_source','state':{'known':{'a':'new'}},'previous_state':initial['state'],'completed_run':'run1'}
  with patch('temporalio.client.Client.connect',new=AsyncMock(return_value=client)):
   await persist_poll_cursor(request)
   self.assertIs(results[0].schedule,schedule)
   self.assertEqual(schedule.action.args[0]['state'],request['state'])
   self.assertNotIn('previous_state',schedule.action.args[0])
   await persist_poll_cursor(request)
   self.assertIsNone(results[1])
   with self.assertRaisesRegex(ValueError,'changed concurrently'):
    await persist_poll_cursor({**request,'completed_run':'run2'})
