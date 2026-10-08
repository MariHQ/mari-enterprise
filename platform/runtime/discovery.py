"""Discover Slack membership without producing synthetic ingestion activity."""
import asyncio
import hashlib
import os
from datetime import timedelta
from temporalio import activity, workflow
from temporalio.common import RetryPolicy


@workflow.defn
class DiscoverSlack:
    @workflow.run
    async def run(self, request: dict):
        while True:
            known = await workflow.execute_activity('discover_slack', request,
                start_to_close_timeout=timedelta(minutes=4), heartbeat_timeout=timedelta(seconds=60),
                retry_policy=RetryPolicy(maximum_attempts=3))
            request = {'known': known}
            await workflow.sleep(timedelta(minutes=15))
            if workflow.info().is_continue_as_new_suggested():
                workflow.continue_as_new(request)


def joined_channels(client, heartbeat=None):
    heartbeat = heartbeat or activity.heartbeat
    from knowledge.connectors import require_slack_access
    channels = {}
    # Query separately so public access works without private-channel scope.
    for channel_type in ('public_channel', 'private_channel'):
        cursor = ''
        while True:
            heartbeat('Discovering joined Slack channels')
            response = client.get('https://slack.com/api/users.conversations', params={
                'types': channel_type, 'exclude_archived': 'true', 'limit': 200, 'cursor': cursor})
            response.raise_for_status()
            data = response.json()
            if channel_type == 'private_channel' and data.get('error') == 'missing_scope':
                break
            require_slack_access(data, 'membership discovery')
            for channel in data.get('channels', []):
                if not channel.get('is_archived'):
                    channels[channel['id']] = channel.get('name', channel['id'])
            cursor = data.get('response_metadata', {}).get('next_cursor', '')
            if not cursor: break
    return dict(sorted(channels.items()))


@activity.defn
async def discover_slack(request: dict):
    import httpx
    from temporalio.client import Client
    from temporalio.exceptions import WorkflowAlreadyStartedError
    from temporalio.service import RPCError, RPCStatusCode
    from knowledge.ingestion import publish_changes
    from knowledge.records import KnowledgeChange
    from knowledge.mappings import topic_for
    from .workflows import SourceSync
    from .observability import event_for, edge_for
    loop = asyncio.get_running_loop()
    def read():
        with httpx.Client(headers={'Authorization': 'Bearer '+os.environ['SLACK_BOT_TOKEN']}, timeout=30) as client:
            return joined_channels(client, lambda message: loop.call_soon_threadsafe(activity.heartbeat, message))
    channels = await asyncio.to_thread(read)
    client = await Client.connect(os.getenv('TEMPORAL_ADDRESS', 'temporal:7233'))
    def workflow_id(channel): return 'poll-sync-slack-'+hashlib.sha256(channel.encode()).hexdigest()[:12]
    targets = []
    for channel, name in channels.items():
        wid = workflow_id(channel)
        try:
            await client.start_workflow(SourceSync.run, {'source':'slack','target':channel}, id=wid, task_queue='mari')
        except WorkflowAlreadyStartedError: pass
        targets.append({'target':channel,'name':name,'workflow_id':wid,'interval_seconds':900})
    previous = request.get('known')
    removed = set(previous or {}) - set(channels)
    for channel in removed:
        try:
            await client.get_workflow_handle(workflow_id(channel)).terminate('Bot no longer belongs to Slack channel')
        except RPCError as error:
            if error.status not in (RPCStatusCode.NOT_FOUND, RPCStatusCode.FAILED_PRECONDITION): raise
    if previous != channels:
        identity = 'temporal:connector:slack'
        changes = [event_for(identity,'temporal_connector','slack',{
            'provider':'slack','mode':'polling','discovery':'joined_channels','targets':targets})[0]]
        for target in targets:
            wid = 'temporal:workflow:'+target['workflow_id']
            changes += [event_for(wid,'temporal_workflow','SourceSync',{'workflow_id':target['workflow_id'],'workflow_type':'SourceSync'})[0], edge_for(identity,'polls',wid)[0]]
        for channel in removed:
            edge = edge_for(identity,'polls','temporal:workflow:'+workflow_id(channel))[0]
            changes.append(KnowledgeChange(table=topic_for('temporal','edge'),record_id=edge.record_id,
                event_id=edge.event_id+':removed:'+activity.info().activity_id, operation='delete',kind='edge',source='temporal'))
        await asyncio.to_thread(publish_changes, changes)
    return channels
