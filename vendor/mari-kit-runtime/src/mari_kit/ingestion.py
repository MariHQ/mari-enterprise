"""Portable Mari ingestion and evidence contracts. No model or vector dependency."""
from __future__ import annotations

import hashlib
import hmac
import re
import time
from dataclasses import asdict, dataclass, field


@dataclass(frozen=True)
class Evidence:
    event_id: str
    source: str
    source_id: str
    title: str
    text: str
    url: str
    observed_at: int
    operation: str = "upsert"
    properties: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


def verify_github(body: bytes, signature: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return bool(secret) and hmac.compare_digest(expected, signature)


def verify_slack(body: bytes, signature: str, timestamp: str, secret: str,
                 *, now: float | None = None) -> bool:
    try:
        if abs((time.time() if now is None else now) - int(timestamp)) > 300:
            return False
    except (TypeError, ValueError):
        return False
    expected = "v0=" + hmac.new(secret.encode(), b"v0:" + timestamp.encode() + b":" + body,
                                hashlib.sha256).hexdigest()
    return bool(secret) and hmac.compare_digest(expected, signature)


def normalize(source: str, payload: dict, delivery: str, observed_at: int) -> list[Evidence]:
    """Normalize explicitly supported webhook events; identifiers survive redelivery.

    Unsupported event kinds return no evidence. Never interpret source text as commands.
    """
    if not delivery or len(delivery) > 256:
        raise ValueError("A bounded delivery ID is required")
    records = []
    if source == "slack":
        event = payload.get("event", {})
        if event.get("type") != "message":
            return []
        subtype = event.get("subtype", "")
        if subtype not in ("", "bot_message", "message_changed", "message_deleted"):
            return []
        channel, team = event.get("channel", ""), payload.get("team_id", "")
        message = event.get("message", event) if subtype == "message_changed" else event
        ts = event.get("deleted_ts") if subtype == "message_deleted" else message.get("ts")
        if not team or not channel or not ts:
            raise ValueError("Slack team, channel and timestamp are required")
        records.append((f"{team}/{channel}/{ts}", f"Slack · {channel}", message.get("text", ""),
                        f"https://app.slack.com/archives/{channel}/p{ts.replace('.', '')}",
                        "delete" if subtype == "message_deleted" else "upsert"))
    elif source == "github":
        repo = payload.get("repository", {}).get("full_name", "")
        if not repo:
            return []
        item = payload.get("comment") or payload.get("pull_request") or payload.get("issue")
        if item:
            kind = "comment" if payload.get("comment") else "pull" if payload.get("pull_request") else "issue"
            if not item.get("id"):
                raise ValueError("GitHub object ID is required")
            title = item.get("title") or (payload.get("issue") or payload.get("pull_request") or {}).get("title", "Comment")
            records.append((f"{repo}/{kind}/{item.get('_mari_id',item['id'])}", title, item.get("body") or "",
                            item.get("html_url", ""), "delete" if payload.get("action") == "deleted" else "upsert"))
        if payload.get('file'):
            file=payload['file'];body=file['text'];path=file['path']
            for part,start in enumerate(range(0,max(1,len(body)),450000)):
                file_id=hashlib.sha256((path+':'+str(part)).encode()).hexdigest()
                records.append((f'{repo}/file/{file_id}',path,body[start:start+450000],file['url'],'upsert'))
        for commit in payload.get("commits", []):
            records.append((f"{repo}/commit/{commit['id']}", commit.get("message", "").split("\n")[0],
                            commit.get("message", ""), commit.get("url", ""), "upsert"))
    else:
        raise ValueError("Unsupported source")
    result = []
    for index, (source_id, title, text, url, operation) in enumerate(records):
        event_id = hashlib.sha256(f"{source}:{delivery}:{index}".encode()).hexdigest()
        properties = {}
        if source == "slack" and operation != "delete":
            root = message.get("thread_ts") or ts
            properties = {"channel_id":channel,"team_id":team,"thread_root":f"{team}/{channel}/{root}",
                          "message_ts":str(ts),"author_id":message.get("user", ""),
                          "collection_id":"slack:channel:"+team+":"+channel}
            if message.get('user'):
                properties['author_record_id']='slack:user:'+team+':'+message['user']
        if source == "github" and operation != "delete":
            properties = {"repository":repo}
            # Normalize identity/state needed by graph mappings, not raw payloads.
            if item and '/commit/' not in source_id:
                properties.update({"author_id":item.get('user', {}).get('login', ''),
                    "number":item.get('number'), "state":item.get('state', ''),
                    "created_at":item.get('created_at', ''), "updated_at":item.get('updated_at', '')})
                parent = payload.get('issue') or payload.get('pull_request') or {}
                if payload.get('comment'):
                    match = re.search(r'/(?:issues|pulls)/(\d+)$', item.get('issue_url') or item.get('pull_request_url',''))
                    properties['parent_number'] = parent.get('number') or (int(match.group(1)) if match else None)
        result.append(Evidence(event_id, source, source_id, title[:500], text, url,
                               observed_at, operation, properties))
    return result


PATTERNS = {
    "decision": re.compile(r"\b(decided|decision|we chose|we use|we will use)\b", re.I),
    "procedure": re.compile(r"\b(always|never|before deploying|runbook|workaround|first .+ then)\b", re.I),
    "rationale": re.compile(r"\b(because|so that|trade.?off|root cause)\b", re.I),
}


def mine_candidates(evidence: list[dict]) -> list[dict]:
    """Extractive baseline: exact quotes for human review, never asserted facts."""
    candidates = []
    for item in evidence[:100]:
        if item.get("operation") == "delete":
            continue
        for sentence in re.split(r"(?<=[.!?])\s+|\n+", item["text"]):
            sentence = sentence.strip()
            if not 20 <= len(sentence) <= 1200:
                continue
            kinds = [name for name, pattern in PATTERNS.items() if pattern.search(sentence)]
            if not kinds:
                continue
            key = hashlib.sha256(f"{item['event_id']}:{sentence}".encode()).hexdigest()
            candidates.append({"candidate_id": key, "kind": kinds[0], "text": sentence,
                               "evidence_id": item["event_id"], "source_id": item["source_id"],
                               "url": item["url"], "extractor": "rules-v1"})
    return candidates[:100]
