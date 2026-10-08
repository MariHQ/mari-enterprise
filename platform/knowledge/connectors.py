"""Allowlisted source polling. Only source names enter Temporal history."""
import hashlib
import json
import os
import time
from dataclasses import replace

import httpx
from temporalio import activity
from temporalio.exceptions import ApplicationError

from mari_kit.ingestion import normalize
from .ingestion import publish_events
from .mappings import topic_for


def fingerprint(payload):
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def emit(source, payload, previous=None, seen=None, generation="", run_id=None):
    records = normalize(source, payload, "poll-normalize", int(time.time()))
    for record in records:
        content = record.to_dict()
        for key in ('event_id', 'observed_at'):
            content.pop(key)
        revision = 'content-v1:' + fingerprint(content)
        prior = (seen or {}).get(record.source_id, (previous or {}).get(record.source_id))
        # Adopt existing raw-payload checkpoints without republishing identical data.
        unchanged = prior == revision or (prior and not prior.startswith('content-v1:') and prior == fingerprint(payload))
        if not unchanged:
            event_id = fingerprint([source, generation, record.source_id, revision])
            record = replace(record, event_id=event_id)
            publish_events([record], connector_id='temporal:connector:'+source, run_id=run_id or generation or None)
        if seen is not None: seen[record.source_id] = revision
    return len(records)


def checked_get(client, url, **kwargs):
    activity.heartbeat("Fetching source page")
    response = client.get(url, **kwargs)
    rate_limited=response.headers.get('x-ratelimit-remaining')=='0' or 'retry-after' in response.headers
    if response.status_code==401 or (response.status_code==403 and not rate_limited):
        raise ApplicationError('Connector access denied by source',type='ConnectorAccessDenied',non_retryable=True)
    response.raise_for_status()
    return response


def require_slack_access(data, operation):
    if data.get('ok'):
        return
    code=data.get('error','unknown')
    permanent=code in {'not_in_channel','missing_scope','invalid_auth','token_revoked','account_inactive','channel_not_found','not_authed'}
    raise ApplicationError(f'Slack {operation} failed: {code}',
                           type='ConnectorAccessDenied' if permanent else 'ConnectorSourceError',
                           non_retryable=permanent)


@activity.defn
def sync_source(request: dict):
    source, target = request["source"], request["target"]
    # Stable across activity retries, distinct for each poll. Restored source
    # contents must not reuse an event ID from before an edit or retraction.
    run_id = activity.info().workflow_run_id
    generation = run_id + ':' + activity.info().activity_id
    count = 0
    previous=request.get("known", {})
    seen={}
    if source == "github":
        allowed = os.getenv("GITHUB_REPOSITORIES", "").split(",")
        if target not in allowed or len(target.split("/")) != 2:
            raise ValueError("GitHub repository is not configured")
        headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
        if os.getenv("GITHUB_TOKEN"):
            headers["Authorization"] = "Bearer " + os.environ["GITHUB_TOKEN"]
        with httpx.Client(headers=headers, timeout=30) as client:
            for collection in ("issues", "issues/comments"):
                page = 1
                while True:
                    response = checked_get(client, f"https://api.github.com/repos/{target}/{collection}", params={"state": "all", "per_page": 100, "page": page})
                    items = response.json()
                    for item in items:
                        kind = "comment" if collection.endswith("comments") else "pull_request" if "pull_request" in item else "issue"
                        count += emit(source, {"repository": {"full_name": target}, kind: item}, previous, seen, generation, run_id)
                    if len(items) < 100:
                        break
                    page += 1
    elif source == "slack":
        # Membership discovery supplies channel IDs; Slack enforces bot access.
        import re
        if not re.fullmatch(r"[CG][A-Z0-9]+", target):
            raise ValueError("Invalid Slack channel ID")
        token, team = os.environ["SLACK_BOT_TOKEN"], os.environ["SLACK_TEAM_ID"]
        with httpx.Client(base_url="https://slack.com/api/", headers={"Authorization": "Bearer " + token}, timeout=30) as client:
            cursor = ""
            while True:
                data = checked_get(client, "conversations.history", params={"channel": target, "limit": 100, "cursor": cursor}).json()
                require_slack_access(data, "history")
                for item in data["messages"]:
                    count += emit(source, {"team_id": team, "event": {**item, "type": "message", "channel": target}}, previous, seen, generation, run_id)
                    if item.get("reply_count"):
                        reply_cursor = ""
                        while True:
                            replies = checked_get(client, "conversations.replies", params={"channel": target, "ts": item["ts"], "limit": 100, "cursor": reply_cursor}).json()
                            require_slack_access(replies, "replies")
                            for reply in replies["messages"]:
                                count += emit(source, {"team_id": team, "event": {**reply, "type": "message", "channel": target}}, previous, seen, generation, run_id)
                            reply_cursor = replies.get("response_metadata", {}).get("next_cursor", "")
                            if not reply_cursor:
                                break
                cursor = data.get("response_metadata", {}).get("next_cursor", "")
                if not cursor:
                    break
    else:
        raise ValueError("Unsupported connector")
    # Only a fully successful inventory can retract missing source records.
    # Authorization or pagination failures above never reach this point.
    from .records import KnowledgeChange, command_id
    from .ingestion import publish_changes
    for identity in previous.keys()-seen.keys():
        kind='message' if source=='slack' else {'pull':'pull_request'}.get(identity.rsplit('/',2)[-2],identity.rsplit('/',2)[-2])
        publish_changes([KnowledgeChange(table=topic_for(source,kind),kind=kind,event_id=command_id('1',source,'missing:'+generation+':'+previous[identity],{'id':identity}),
            record_id=identity,operation='delete',source=source,actor=source)])
    return {"source": source, "target": target, "scanned": count, "known":seen}
